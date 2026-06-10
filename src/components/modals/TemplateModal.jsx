import { LayoutTemplate, X, Heart, Zap, Book, Plane, Dumbbell, ChevronRight } from "lucide-react";
import { TEMPLATES } from "../../constants/templates";

const TEMPLATE_STYLES = {
  wellness: { bg: "bg-cyan-500", icon: Heart },
  founder: { bg: "bg-blue-600", icon: Zap },
  student: { bg: "bg-purple-500", icon: Book },
  travel: { bg: "bg-sky-500", icon: Plane },
  fitness: { bg: "bg-red-500", icon: Dumbbell },
};

const TemplateModal = ({ onApply, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <LayoutTemplate size={20} />
          <h3 className="text-lg font-bold">Start with a Template</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 grid md:grid-cols-3 gap-4 overflow-y-auto bg-gray-50/50">
        {Object.entries(TEMPLATES).map(([key, tpl]) => {
          const style = TEMPLATE_STYLES[key];
          const Icon = style.icon;
          return (
            <button
              key={key}
              onClick={() => onApply(key)}
              className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all text-left group"
            >
              <div className={`w-10 h-10 rounded-full mb-3 flex items-center justify-center text-white shadow-md ${style.bg}`}>
                <Icon size={18} />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">{tpl.name}</h4>
              <p className="text-xs text-gray-500 mb-3">Pre-configured trackers, quotes & goals.</p>
              <div className="text-violet-600 text-xs font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Use <ChevronRight size={12} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default TemplateModal;
