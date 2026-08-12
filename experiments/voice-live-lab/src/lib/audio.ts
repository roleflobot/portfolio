export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Int16Array(bytes.buffer);
}

function sampleRateFromMimeType(mimeType?: string) {
  const match = mimeType?.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24_000;
}

export class PcmPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  async prepare() {
    if (!this.context) this.context = new AudioContext({ sampleRate: 24_000 });
    if (this.context.state === "suspended") await this.context.resume();
  }

  async enqueue(base64: string, mimeType?: string) {
    await this.prepare();
    if (!this.context) return;

    const pcm = base64ToInt16(base64);
    const rate = sampleRateFromMimeType(mimeType);
    const audioBuffer = this.context.createBuffer(1, pcm.length, rate);
    const channel = audioBuffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = pcm[index] / 32768;
    }

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.context.destination);
    const startTime = Math.max(this.context.currentTime + 0.025, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // The source may already have ended between iteration and stop().
      }
    }
    this.sources.clear();
    this.nextStartTime = this.context?.currentTime ?? 0;
  }

  async close() {
    this.interrupt();
    await this.context?.close();
    this.context = null;
  }
}

export type MicrophoneCapture = {
  sampleRate: number;
  stop: () => Promise<void>;
};

export async function startMicrophone(
  onChunk: (pcm: ArrayBuffer, sampleRate: number) => void
): Promise<MicrophoneCapture> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저는 마이크 입력을 지원하지 않습니다.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });

  const context = new AudioContext({ sampleRate: 16_000 });
  await context.audioWorklet.addModule("/pcm-recorder-worklet.js");
  const source = context.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(context, "pcm-recorder");
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  recorder.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (event.data instanceof ArrayBuffer) onChunk(event.data, context.sampleRate);
  };
  source.connect(recorder);
  recorder.connect(silentGain);
  silentGain.connect(context.destination);
  await context.resume();

  return {
    sampleRate: context.sampleRate,
    stop: async () => {
      recorder.port.onmessage = null;
      source.disconnect();
      recorder.disconnect();
      silentGain.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close();
    },
  };
}
