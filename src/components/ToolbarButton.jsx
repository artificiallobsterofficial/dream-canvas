const ToolbarButton = ({ icon: Icon, label, onClick, active = false, special = false }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-full ${
      active
        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
        : special
        ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg"
        : "hover:bg-gray-100 text-gray-600 dark:hover:bg-slate-800 dark:text-slate-400"
    }`}
    title={label}
  >
    <Icon size={special ? 20 : 18} className={special ? "" : "mb-0.5"} />
    {!special && <span className="text-[10px] font-medium leading-tight">{label}</span>}
  </button>
);

export default ToolbarButton;
