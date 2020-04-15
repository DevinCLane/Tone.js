import { ToneAudioNode, ToneAudioNodeOptions } from "../../core/context/ToneAudioNode";
import { Gain } from "../../core/context/Gain";
import { assert } from "../../core/util/Debug";
import { theWindow } from "../../core/context/AudioContext";
import { optionsFromArguments } from "../../core/util/Defaults";
import { PlaybackState } from "../../core/util/StateTimeline";
import { Context } from "../../core/context/Context";

export interface RecorderOptions extends ToneAudioNodeOptions {
	mimeType?: string;
}

/**
 * This is only natively supported in Chrome and Firefox. 
 * For a cross-browser shim, install (MediaStreamRecorder)[https://github.com/streamproc/MediaStreamRecorder]. 
 * @example
 * import { Recorder, Synth } from "tone";
 * const recorder = new Recorder();
 * const synth = new Synth().connect(recorder);
 * // start recording
 * recorder.start();
 * // generate a few notes
 * synth.triggerAttackRelease("C3", 0.5);
 * synth.triggerAttackRelease("C4", 0.5, "+1");
 * synth.triggerAttackRelease("C5", 0.5, "+2");
 * // wait for the notes to end and stop the recording
 * setTimeout(async () => {
 * 	// the recorded audio is returned as a blob
 * 	const recording = await recorder.stop();
 * 	// download the recording by creating an anchor element and blob url
 * 	const url = URL.createObjectURL(recording);
 * 	const anchor = document.createElement("a");
 * 	anchor.download = "recording.webm";
 * 	anchor.href = url;
 * 	anchor.click();
 * }, 4000);
 */
export class Recorder extends ToneAudioNode<RecorderOptions> {

	readonly name = "Recorder";

	/**
	 * Recorder uses the Media Recorder API
	 */
	private _recorder: MediaRecorder;

	/**
	 * MediaRecorder requires 
	 */
	private _stream: MediaStreamAudioDestinationNode;

	readonly input: Gain;
	readonly output: undefined;

	constructor(options?: Partial<RecorderOptions>);
	constructor() {

		super(optionsFromArguments(Recorder.getDefaults(), arguments, ["gain", "units"]));
		const options = optionsFromArguments(Recorder.getDefaults(), arguments, ["gain", "units"]);

		this.input = new Gain({
			context: this.context
		});

		assert(Recorder.supported, "Media Recorder API is not available");

		this._stream = this.context.createMediaStreamDestination();
		this.input.connect(this._stream);
		this._recorder = new MediaRecorder(this._stream.stream, {
			mimeType: options.mimeType
		});
	}

	static getDefaults(): RecorderOptions {
		return ToneAudioNode.getDefaults();
	}

	/**
	 * The mime type is the format that the audio is encoded in. For Chrome 
	 * that is typically webm encoded as "vorbis". 
	 */
	get mimeType(): string {
		return this._recorder.mimeType;
	}

	/**
	 * Test if your platform supports the Media Recorder API. If it's not available, 
	 * try installing this (polyfill)[https://github.com/streamproc/MediaStreamRecorder]. 
	 */
	static get supported(): boolean {
		return theWindow !== null && Reflect.has(theWindow, "MediaRecorder");
	}

	/**
	 * Get the playback state of the Recorder, either "started", "stopped" or "paused"
	 */
	get state(): PlaybackState {
		if (this._recorder.state === "inactive") {
			return "stopped";
		} else if (this._recorder.state === "paused") {
			return "paused";
		} else {
			return "started";
		}
	}

	start(): this {
		assert(this.state !== "started", "Recorder is already started");
		this._recorder.start();
		return this;
	}

	async stop(): Promise<Blob> {
		assert(this.state !== "stopped", "Recorder is not started");
		const dataPromise: Promise<Blob> = new Promise(done => {
			this._recorder.ondataavailable = (e: BlobEvent) => done(e.data);
		});
		this._recorder.stop();
		return await dataPromise;
	}

	pause(): this {
		assert(this.state === "started", "Recorder must be started");
		this._recorder.pause();
		return this;
	}

	dispose(): this {
		super.dispose();
		this.input.dispose();
		this._stream.disconnect();
		return this;
	}
}