let context;
const tones = {
  pick: [370, 554],
  preview: [440, 660],
  drop: [162, 246, 367],
  curse: [77, 109, 156],
  end: [120, 172, 250, 320],
};

export function chime(event) {
  try {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    for (const [index, frequency] of tones[event].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime + index * 0.045;
      const duration = event === 'curse' || event === 'end' ? 0.5 : 0.24;
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(0.052 / (index+1), time + 0.032);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.01);
    }
  } catch {
    // The game never requires audio support.
  }
}
