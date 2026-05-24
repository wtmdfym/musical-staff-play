export interface MidiDeviceInfo {
  id: string;
  name: string;
}

export type MidiStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "denied"
  | "unavailable";

export class MidiInputManager {
  private _access: MIDIAccess | null = null;
  private _input: MIDIInput | null = null;
  private _status: MidiStatus = "disconnected";
  private _devices: MidiDeviceInfo[] = [];
  private _onStatusChange: ((status: MidiStatus) => void) | null = null;
  private _onNoteOn: ((pitch: number, velocity: number) => void) | null = null;
  private _onDevicesChange: ((devices: MidiDeviceInfo[]) => void) | null = null;
  private _stateChangeHandler: ((e: MIDIConnectionEvent) => void) | null = null;

  get status(): MidiStatus {
    return this._status;
  }
  get devices(): MidiDeviceInfo[] {
    return this._devices;
  }
  get inputName(): string {
    return this._input?.name ?? "";
  }
  /** 是否已成功获取 MIDIAccess */
  get isAccessGranted(): boolean {
    return this._access !== null;
  }

  set onStatusChange(cb: ((status: MidiStatus) => void) | null) {
    this._onStatusChange = cb;
  }
  set onNoteOn(cb: ((pitch: number, velocity: number) => void) | null) {
    this._onNoteOn = cb;
  }
  set onDevicesChange(cb: ((devices: MidiDeviceInfo[]) => void) | null) {
    this._onDevicesChange = cb;
  }

  private _setStatus(s: MidiStatus): void {
    if (this._status === s) return;
    this._status = s;
    this._onStatusChange?.(s);
  }

  private _setDevices(devices: MidiDeviceInfo[]): void {
    this._devices = devices;
    this._onDevicesChange?.(devices);
  }

  private _handleMessage = (e: MIDIMessageEvent): void => {
    const data = e.data;
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0;
    const pitch = data[1];
    const velocity = data[2];
    if (status === 0x90 && velocity > 0) {
      this._onNoteOn?.(pitch, velocity);
    }
  };

  private _refreshDevices(): void {
    if (!this._access) {
      this._setDevices([]);
      return;
    }
    const devices: MidiDeviceInfo[] = [];
    for (const input of this._access.inputs.values()) {
      if (input.id) {
        devices.push({ id: input.id, name: input.name ?? "" });
      }
    }
    this._setDevices(devices);
  }

  private _setupStateHandler(): void {
    if (!this._access) return;
    this._stateChangeHandler = (e: MIDIConnectionEvent) => {
      this._refreshDevices();
      if (e.port && e.port === this._input && e.port.state === "disconnected") {
        this._input = null;
        this._setStatus("disconnected");
      }
    };
    this._access.onstatechange = this._stateChangeHandler;
  }

  async requestAccess(): Promise<boolean> {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      console.warn("Web MIDI 需要安全上下文 (HTTPS / localhost)");
      this._setStatus("unavailable");
      return false;
    }
    if (
      typeof navigator === "undefined" ||
      !("requestMIDIAccess" in navigator)
    ) {
      this._setStatus("unavailable");
      return false;
    }
    try {
      this._setStatus("connecting");
      this._access = await navigator.requestMIDIAccess();
      this._refreshDevices();
      this._setupStateHandler();
      this._setStatus("disconnected");
      return true;
    } catch {
      this._setStatus("denied");
      return false;
    }
  }

  open(deviceId?: string): boolean {
    if (!this._access) return false;
    this.close();
    if (deviceId && this._access.inputs.has(deviceId)) {
      const input = this._access.inputs.get(deviceId)!;
      if (input.state !== "connected") return false;
      this._input = input;
    } else {
      for (const input of this._access.inputs.values()) {
        if (input.state === "connected") {
          this._input = input;
          break;
        }
      }
    }
    if (!this._input) {
      this._setStatus("disconnected");
      return false;
    }
    this._input.onmidimessage = this._handleMessage;
    this._setStatus("connected");
    return true;
  }

  close(): void {
    if (this._input) {
      this._input.onmidimessage = null;
      this._input = null;
    }
    this._setStatus("disconnected");
  }

  destroy(): void {
    this.close();
    if (this._access && this._stateChangeHandler) {
      this._access.onstatechange = null;
    }
    this._access = null;
    this._stateChangeHandler = null;
    this._setDevices([]);
  }
}

let _instance: MidiInputManager | null = null;

export function getMidiInputManager(): MidiInputManager {
  if (!_instance) {
    _instance = new MidiInputManager();
  }
  return _instance;
}
