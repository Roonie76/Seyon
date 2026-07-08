import type { SVGProps } from "react";

export default function SocialPlatformsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Outer dashed connector circle */}
      <circle cx="12" cy="12" r="8.8" strokeWidth="1.2" strokeDasharray="2 3" />

      {/* Smartphone body */}
      <rect x="9" y="5.5" width="6" height="13" rx="1.5" />
      {/* Speaker capsule */}
      <line x1="11" y1="6.8" x2="13" y2="6.8" strokeWidth="1.2" />
      {/* Screen bottom home line */}
      <line x1="11" y1="17.2" x2="13" y2="17.2" strokeWidth="1.2" />

      {/* Connecting lines from phone to circles */}
      <line x1="12" y1="5.5" x2="12" y2="4.4" />
      <line x1="9" y1="10" x2="7" y2="9.7" />
      <line x1="15" y1="10" x2="17" y2="9.7" />
      <line x1="9" y1="16.5" x2="7.4" y2="17.2" />
      <line x1="15" y1="16.5" x2="16.6" y2="17.2" />

      {/* 5 Social Nodes (White/Bezel fill to mask the dashed circle behind) */}
      
      {/* Top Circle - Creators */}
      <circle cx="12" cy="2.8" r="1.6" fill="white" className="lg:fill-[#FCFAF7]" />
      {/* Creators glyph */}
      <circle cx="12" cy="2.2" r="0.5" strokeWidth="1.2" />
      <path d="M10.8 3.8 a 1.2 1.2 0 0 1 2.4 0" strokeWidth="1.2" />

      {/* Left Circle - Instagram */}
      <circle cx="5" cy="9.5" r="1.6" fill="white" className="lg:fill-[#FCFAF7]" />
      {/* Instagram camera glyph */}
      <rect x="4.1" y="8.7" width="1.8" height="1.6" rx="0.5" strokeWidth="1.2" />
      <circle cx="5" cy="9.5" r="0.5" strokeWidth="1.2" />
      <circle cx="5.5" cy="9.0" r="0.1" fill="currentColor" stroke="none" />

      {/* Right Circle - YouTube */}
      <circle cx="19" cy="9.5" r="1.6" fill="white" className="lg:fill-[#FCFAF7]" />
      {/* YouTube play glyph */}
      <polygon points="18.5,8.7 20,9.5 18.5,10.3" strokeWidth="1.2" />

      {/* Bottom-Left Circle - Telegram */}
      <circle cx="6" cy="18" r="1.6" fill="white" className="lg:fill-[#FCFAF7]" />
      {/* Telegram paper plane glyph */}
      <path d="M5.0 18.2 l1.8 -1.0 l-.7 1.4 l-.1 -.4 Z" strokeWidth="1.2" />

      {/* Bottom-Right Circle - Chat bubble */}
      <circle cx="18" cy="18" r="1.6" fill="white" className="lg:fill-[#FCFAF7]" />
      {/* Chat bubble glyph */}
      <path d="M17.2 17.6 a 0.8 0.8 0 0 1 1.4 -.4 l.2 .4 l-.4 -.1" strokeWidth="1.2" />

      {/* Center WhatsApp Bubble on screen */}
      <path d="M12 9.5 a 2.5 2.5 0 0 0 -2.2 3.6 l -.3 1.1 1.1 -.3 A 2.5 2.5 0 1 0 12 9.5 z" fill="white" className="lg:fill-[#FCFAF7]" strokeWidth="1.6" />
      {/* Three dots inside WhatsApp bubble */}
      <circle cx="11.0" cy="12" r="0.25" fill="currentColor" stroke="none" />
      <circle cx="12.0" cy="12" r="0.25" fill="currentColor" stroke="none" />
      <circle cx="13.0" cy="12" r="0.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
