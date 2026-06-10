import { useState, useEffect } from "react";

const CountdownWidget = ({ target }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const dist = new Date(target).getTime() - Date.now();
      if (dist < 0) setTimeLeft("DONE!");
      else {
        const d = Math.floor(dist / (1000 * 60 * 60 * 24));
        const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft(`${d}d ${h}h`);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [target]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 text-center rounded-lg">
      <div className="text-xl font-bold font-mono tracking-widest">{timeLeft || "..."}</div>
      <div className="text-[9px] uppercase tracking-wide opacity-75 mt-1">Until Goal</div>
    </div>
  );
};

export default CountdownWidget;
