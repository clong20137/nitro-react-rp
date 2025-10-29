import { INitroPoint } from '@nitrots/nitro-renderer';

export class ChatBubbleMessage {
    public static BUBBLE_COUNTER = 0;

    public id = -1;
    public width = 0;
    public height = 0;
    public elementRef: HTMLDivElement = null;
    public visible = false;
    public skipMovement = false;

    private _top = 0;
    private _left = 0;

    constructor(
        public senderId: number = -1,
        public senderCategory: number = -1,
        public roomId: number = -1,
        public text: string = '',
        public formattedText: string = '',
        public username: string = '',
        public location: INitroPoint = null,
        public type: number = 0,
        public styleId: number = 0,
        public imageUrl: string = null,
        public color: string = null,

        /** NEW: name icon */
        public nameIconKey?: string, // e.g. "1" or "crown_pink"
        public showNameIcon: boolean = true // user toggle
    ) {
        this.id = ++ChatBubbleMessage.BUBBLE_COUNTER;
    }

    get top(): number {
        return this._top;
    }
    set top(value: number) {
        this._top = value;
        if (this.elementRef) this.elementRef.style.top = this._top + 'px';
    }

    get left(): number {
        return this._left;
    }
    set left(value: number) {
        this._left = value;
        if (this.elementRef) this.elementRef.style.left = this._left + 'px';
    }
}
