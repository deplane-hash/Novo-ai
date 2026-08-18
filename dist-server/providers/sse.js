export function parseSSE(body, onData) {
    if (!body)
        return Promise.resolve();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    function handleLine(line) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:'))
            return;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]')
            return;
        onData(data);
    }
    return new Promise((resolve) => {
        ;
        (async () => {
            try {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    let idx;
                    while ((idx = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, idx);
                        buffer = buffer.slice(idx + 1);
                        if (line.startsWith('data:'))
                            handleLine(line);
                        else if (line === '') { /* event boundary */ }
                        else if (line.startsWith('event:')) { /* ignore event name */ }
                    }
                }
                if (buffer.trim())
                    handleLine(buffer);
            }
            catch (err) {
                // stream aborted by client or network — treat as clean end
            }
            finally {
                resolve();
            }
        })();
    });
}
