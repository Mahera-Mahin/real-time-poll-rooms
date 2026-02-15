'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useSocket } from '@/hooks/useSocket';
import { getOrCreateVoterToken } from '@/lib/voterToken';

type Option = { id: string; text: string; votesCount: number };
type Poll = {
  id: string;
  question: string;
  options: Option[];
  totalVotes: number;
};

export default function PollPage() {
  const params = useParams();
  const router = useRouter();
  const pollId = typeof params?.id === 'string' ? params.id : null;

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [voteError, setVoteError] = useState('');

  const { results: liveResults, connected } = useSocket(pollId);

  const fetchPoll = useCallback(async () => {
    if (!pollId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get<{ poll: Poll }>(`/api/polls/${pollId}`);
      setPoll(data.poll);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) setError('Poll not found.');
        else if (err.response?.status === 410) setError('This poll has expired.');
        else setError('Failed to load poll.');
      } else {
        setError('Failed to load poll.');
      }
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const displayResults = liveResults ?? (poll ? {
    results: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      votesCount: o.votesCount,
      percentage: poll.totalVotes > 0
        ? Math.round((o.votesCount / poll.totalVotes) * 100)
        : 0,
    })),
    totalVotes: poll.totalVotes,
  } : null);

  const handleVote = async (optionId: string) => {
    if (!pollId || voted) return;
    setVoteError('');
    setVoting(optionId);
    try {
      const voterToken = getOrCreateVoterToken();
      await axios.post(`/api/polls/${pollId}/vote`, {
        optionId,
        voterToken,
      });
      setVoted(true);
      setVoting(null);
      await fetchPoll();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error ?? 'Failed to vote';
        setVoteError(msg);
        if (err.response?.status === 409) setVoted(true);
        if (err.response?.status === 410) fetchPoll();
      } else {
        setVoteError('Failed to vote.');
      }
      setVoting(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-slate-600">Loading poll…</p>
      </main>
    );
  }

  if (error || !poll) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-red-600">{error || 'Poll not found.'}</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 text-slate-600 underline hover:text-slate-800"
        >
          ← Back to create poll
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <a
        href="/"
        className="mb-6 inline-block text-sm text-slate-600 hover:text-slate-800"
      >
        ← Create another poll
      </a>

      <h1 className="mb-2 text-xl font-semibold text-slate-800">
        {poll.question}
      </h1>
      {connected && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live
        </span>
      )}

      <div className="mt-6 space-y-4">
        {poll.options.map((opt) => {
          const pct = displayResults
            ? displayResults.results.find((r) => r.id === opt.id)?.percentage ?? 0
            : 0;
          const disabled = voted || !!voting;
          return (
            <div key={opt.id} className="relative">
              <button
                type="button"
                onClick={() => handleVote(opt.id)}
                disabled={disabled}
                className="relative w-full rounded-lg border border-slate-300 bg-white py-3 pl-4 pr-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-80"
              >
                <span className="relative z-10">{opt.text}</span>
                {voted && (
                  <span
                    className="absolute inset-y-0 left-0 rounded-l-lg bg-slate-200 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                {voted && (
                  <span className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-600">
                    {pct}%
                  </span>
                )}
                {voting === opt.id && (
                  <span className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-500">
                    Voting…
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {voted && (
        <p className="mt-4 text-sm text-slate-600">
          You have already voted.
        </p>
      )}

      {voteError && (
        <p className="mt-2 text-sm text-red-600">{voteError}</p>
      )}

      {displayResults && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            Results
          </h2>
          <div className="space-y-3">
            {displayResults.results.map((r) => (
              <div key={r.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{r.text}</span>
                  <span className="text-slate-600">
                    {r.votesCount} ({r.percentage}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-600"
                    style={{ width: `${r.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Total votes: {displayResults.totalVotes}
          </p>
        </div>
      )}
    </main>
  );
}
