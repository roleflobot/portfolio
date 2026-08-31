class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(2048);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, channel[index]));
      this.buffer[this.offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.offset += 1;

      if (this.offset === this.buffer.length) {
        const chunk = this.buffer.buffer;
        this.port.postMessage(chunk, [chunk]);
        this.buffer = new Int16Array(2048);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorderProcessor);
