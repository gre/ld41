const context = new AudioContext();

const audioFiles = {
  tetris1Loop: "/tetris1_loop.m4a",
  tetris2Loop: "/tetris2_loop.m4a",
  tetrisbgLoop: "/tetrisbg_loop.m4a",
  turn: "/turn.wav",
  melt: "./melt.wav",
  fall: "./fall.wav",
  explode: "./explode.wav",
  row: "./row.wav"
};

const loadSound = (url: string): Promise<AudioBuffer> =>
  new Promise((success, failure) => {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = () => {
      context.decodeAudioData(request.response, success, failure);
    };
    request.send();
  });

const playNow = ({ buffer, output }) => {
  if (buffer) {
    const source = context.createBufferSource();
    source.connect(output);
    source.buffer = buffer;
    source.start(0);
    setTimeout(() => {
      source.disconnect(output);
    }, 1000 * (buffer.duration + 1));
  }
};

let sync;
if (!context) {
  sync = () => {};
} else {
  const compressor = context.createDynamicsCompressor();
  compressor.connect(context.destination);

  const out = context.createGain();
  out.gain.value = 0;
  out.connect(compressor);

  const musicNode = context.createGain();
  musicNode.gain.value = 1;
  musicNode.connect(out);

  const soundsOutput = {
    tetris1Loop: musicNode,
    tetris2Loop: musicNode,
    tetrisbgLoop: musicNode
  };

  const sounds = {};
  Object.keys(audioFiles).forEach(name => {
    const output = context.createGain();
    output.connect(soundsOutput[name] || out);
    const bufferPromise = loadSound(audioFiles[name]);
    const sound = {
      output,
      bufferPromise,
      buffer: null
    };
    sounds[name] = sound;
    bufferPromise.then(
      buffer => {
        sound.buffer = buffer;
      },
      err => {
        console.warn("Can't load sound " + name);
      }
    );
  });

  const musics = [sounds.tetrisbgLoop, sounds.tetris1Loop, sounds.tetris2Loop];
  Promise.all(musics.map(m => m.bufferPromise)).then(buffers => {
    const schedule = context.currentTime + 0.1;
    musics.forEach(({ buffer, output }) => {
      const source = context.createBufferSource();
      source.loop = true;
      source.connect(output);
      source.buffer = buffer;
      source.start(schedule);
    });
    sounds.tetrisbgLoop.output.gain.value = 1;
    sounds.tetris1Loop.output.gain.value = 0;
    sounds.tetris2Loop.output.gain.value = 0;
  });

  sync = ({
    volume,
    musicVolume,
    melodyVolume,
    mix,
    triggerRow,
    triggerFall,
    triggerTurn,
    triggerMelt,
    triggerExplode
  }) => {
    out.gain.value = volume;
    musicNode.gain.value = musicVolume;
    sounds.tetris1Loop.output.gain.value = melodyVolume * mix;
    sounds.tetris2Loop.output.gain.value = melodyVolume * (1 - mix);
    if (triggerTurn) playNow(sounds.turn);
    if (triggerRow) playNow(sounds.row);
    if (triggerFall) playNow(sounds.fall);
    if (triggerExplode) playNow(sounds.explode);
    if (triggerMelt) playNow(sounds.melt);
  };
}

export default sync;
