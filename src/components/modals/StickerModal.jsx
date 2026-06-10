import { Smile, X, Lock } from "lucide-react";
import { STICKER_PACKS } from "../../constants/stickers";

const StickerModal = ({ userLevel, onPick, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-3 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Smile size={18} />
          <h3 className="font-bold">Stickers</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 overflow-y-auto">
        <div className="space-y-4">
          {Object.entries(STICKER_PACKS).map(([category, pack]) => {
            const isLocked = userLevel < pack.levelReq;
            return (
              <div key={category} className={isLocked ? "opacity-50 grayscale" : ""}>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">
                  {category}
                  {isLocked && (
                    <span className="text-pink-500 flex items-center gap-0.5">
                      <Lock size={9} /> Lv{pack.levelReq}
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-7 gap-1">
                  {pack.stickers.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!isLocked) onPick(emoji);
                      }}
                      disabled={isLocked}
                      className={`text-2xl p-1.5 rounded-lg transition-transform ${isLocked ? "cursor-not-allowed" : "hover:bg-gray-100 hover:scale-125"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

export default StickerModal;
