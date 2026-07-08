import * as React from 'react';

interface PrivacyTableProps {
  headers: string[];
  rows: string[][];
}

export function PrivacyTable({ headers, rows }: PrivacyTableProps) {
  return (
    <div className="w-full border border-zinc-200 rounded-xl overflow-hidden shadow-2xs my-4 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 font-bold text-zinc-950 border-r last:border-r-0 border-zinc-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-zinc-50/50 transition-colors"
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-3 text-zinc-600 font-medium leading-relaxed border-r last:border-r-0 border-zinc-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PrivacyTable;
