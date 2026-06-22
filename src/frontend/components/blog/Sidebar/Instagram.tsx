
export function Instagram() {
  const instaImages = [
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?q=80&w=400',
    'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?q=80&w=400',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=400',
    'https://images.unsplash.com/photo-1611085583191-a3b1a30a5a2a?q=80&w=400',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=400',
    'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=400',
  ];

  const moodImages = [
    'https://images.unsplash.com/photo-1576016770956-debb63d900ad?q=80&w=400',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?q=80&w=400',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=400',
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=400',
  ];

  return (
    <div className="space-y-8">
      {/* Instagram Grid Section */}
      <div className="space-y-6">
        <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
          Instagram
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {instaImages.map((src, i) => (
            <a
              key={i}
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="relative group aspect-square block overflow-hidden bg-black rounded-sm border border-zinc-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-75"
              />
            </a>
          ))}
        </div>
      </div>

      {/* Moodboard Frame Section */}
      <div className="p-6 bg-white border border-zinc-200 rounded-sm shadow-md text-center space-y-4">
        {/* Moodboard Grid */}
        <div className="grid grid-cols-2 gap-2">
          {moodImages.map((src, i) => (
            <div key={i} className="aspect-square bg-zinc-100 overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* Serif Brand Name at the bottom of the white frame */}
        <div className="pt-2">
          <p className="text-[11px] font-medium tracking-[0.3em] uppercase text-zinc-400 font-serif italic">
            M O O D A E S T H E T I C S
          </p>
        </div>
      </div>
    </div>
  );
}
