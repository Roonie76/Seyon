import * as React from 'react';
import { Check, X } from 'lucide-react';

interface MatrixRow {
  activity: string;
  buyer: boolean;
  seller: boolean;
  seyon: boolean | 'x';
}

const matrixData: MatrixRow[] = [
  { activity: 'Discover Products', buyer: true, seller: true, seyon: true },
  { activity: 'Manage Catalog', buyer: false, seller: true, seyon: false },
  { activity: 'Pricing', buyer: false, seller: true, seyon: false },
  { activity: 'Negotiation', buyer: true, seller: true, seyon: false },
  { activity: 'Payment', buyer: true, seller: true, seyon: 'x' },
  { activity: 'Delivery', buyer: false, seller: true, seyon: 'x' },
  { activity: 'Returns', buyer: false, seller: true, seyon: 'x' },
  { activity: 'Fraud Report', buyer: true, seller: true, seyon: true },
  { activity: 'Moderation', buyer: false, seller: false, seyon: true },
  { activity: 'Store Suspension', buyer: false, seller: false, seyon: true },
];

export function ResponsibilityMatrix() {
  return (
    <div className="my-8 overflow-hidden rounded-[20px] border border-[#ECE5D9] bg-[#FFFEFC] shadow-[0_1px_3px_rgba(0,0,0,0.02)] font-sans">
      <div className="px-5 py-4 border-b border-[#ECE5D9] bg-[#FFFEFC]">
        <h3 className="text-sm font-semibold text-[#1A1A18] font-serif">Marketplace Responsibility Matrix</h3>
        <p className="text-xs text-[#6F6A63] mt-0.5">Quick guide to who handles what on Seyon</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead>
            <tr className="border-b border-[#ECE5D9] bg-[#FAF8F4]/80 text-[10px] font-bold uppercase tracking-widest text-[#6F6A63]">
              <th className="px-5 py-3">Responsibility</th>
              <th className="px-5 py-3 text-center">Buyer</th>
              <th className="px-5 py-3 text-center">Seller</th>
              <th className="px-5 py-3 text-center">Seyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECE5D9]/50 bg-white">
            {matrixData.map((row) => (
              <tr key={row.activity} className="hover:bg-[#FAF8F4] transition-colors duration-150">
                <td className="px-5 py-3.5 font-medium text-[#1A1A18]">{row.activity}</td>
                <td className="px-5 py-3.5 text-center">
                  {row.buyer ? (
                    <Check className="h-4.5 w-4.5 text-[#B88A2E] mx-auto stroke-[1.5]" />
                  ) : null}
                </td>
                <td className="px-5 py-3.5 text-center">
                  {row.seller ? (
                    <Check className="h-4.5 w-4.5 text-[#B88A2E] mx-auto stroke-[1.5]" />
                  ) : null}
                </td>
                <td className="px-5 py-3.5 text-center">
                  {row.seyon === true ? (
                    <Check className="h-4.5 w-4.5 text-[#B88A2E] mx-auto stroke-[1.5]" />
                  ) : row.seyon === 'x' ? (
                    <X className="h-4.5 w-4.5 text-[#6F6A63] mx-auto stroke-[1.5]" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
