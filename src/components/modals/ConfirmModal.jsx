import { AlertTriangle } from "lucide-react";

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
      <div className="flex flex-col items-center text-center mb-4">
        <div className="bg-orange-100 text-orange-600 p-2 rounded-full mb-2">
          <AlertTriangle size={20} />
        </div>
        <h3 className="font-bold text-gray-900">Are you sure?</h3>
        <p className="text-xs text-gray-500 mt-1">{message}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
          Cancel
        </button>
        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
          Confirm
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
