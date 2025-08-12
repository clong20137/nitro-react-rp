import { Nitro } from '@nitrots/nitro-renderer';
import { DispatchUiEvent, RoomWidgetUpdateChatInputContentEvent } from '../api';
export function initEventBridge() {
    window.addEventListener('message', (event) => {
        const { type, content } = event.data;

        if (type === 'sendWhisper') {
            if (typeof content === 'string' && content.length > 0) {
                const userName = Nitro.instance.sessionDataManager.userName;

                // Step 1: Open whisper input UI directed to self
                DispatchUiEvent(
                    new RoomWidgetUpdateChatInputContentEvent(
                        RoomWidgetUpdateChatInputContentEvent.WHISPER,
                        userName
                    )
                );

                // Step 2: Auto-fill and auto-send the message
                setTimeout(() => {
                    const input = document.querySelector(
                        'input.chat-input'
                    ) as HTMLInputElement;
                    if (!input) return;

                    // Fill & fire Enter
                    input.value = `:whisper ${userName} ${content}`;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(
                        new KeyboardEvent('keydown', {
                            bubbles: true,
                            cancelable: true,
                            key: 'Enter',
                            code: 'Enter',
                            which: 13,
                            keyCode: 13,
                        })
                    );

                    // --- NEW: clear the bar so text doesn’t linger ---
                    setTimeout(() => {
                        input.value = '';
                        input.dispatchEvent(
                            new Event('input', { bubbles: true })
                        );
                    }, 25);
                }, 50);
            }
        }
    });
}
