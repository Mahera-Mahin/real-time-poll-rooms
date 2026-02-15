'use client';

import { useState } from 'react';
import axios from 'axios';

export default function CreatePollPage() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q) {
      setError('Question is required.');
      return;
    }
    if (opts.length < 2) {
      setError('At least 2 options are required.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<{ shareUrl: string }>('/api/polls', {
        question: q,
        options: opts,
      });
      setShareUrl(data.shareUrl);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to create poll';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-8 text-2xl font-semibold text-slate-800">
        Create a poll
      </h1>

      {shareUrl ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="mb-2 text-sm font-medium text-emerald-800">
            Poll created. Share this link:
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Copy
            </button>
          </div>
          <a
            href={shareUrl}
            className="mt-3 inline-block text-sm text-emerald-700 underline"
          >
            Open poll →
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Your question?"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Options (min 2)
              </label>
              <button
                type="button"
                onClick={addOption}
                disabled={options.length >= 10}
                className="text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <ul className="space-y-2">
              {options.map((opt, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create poll'}
          </button>
        </form>
      )}
    </main>
  );
}
