// Custom TipTap Extension for Double-Enter AI Improvement
const DoubleEnterAI = Tiptap.Extension.create({
    name: 'doubleEnterAI',

    addOptions() {
        return {
            onDoubleEnter: () => {},
            timeout: 800, // 800ms timeout for double press detection
        }
    },

    addKeyboardShortcuts() {
        let lastEnterTime = 0;

        return {
            Enter: ({ editor }) => {
                const now = Date.now();
                const timeDiff = now - lastEnterTime;

                console.log('Enter pressed. Time diff:', timeDiff, 'ms');

                // Double-tap detection (within timeout but more than 50ms to avoid accidental)
                if (timeDiff < this.options.timeout && timeDiff > 50) {
                    console.log('Double Enter detected! Triggering AI improvement...');
                    
                    // Prevent default behavior (don't insert new line)
                    // Call AI improvement function
                    this.options.onDoubleEnter(editor);
                    
                    // Reset timer
                    lastEnterTime = 0;
                    return true; // Prevent default
                }

                lastEnterTime = now;
                return false; // Allow default behavior for single enter
            }
        }
    }
});

// Make it globally available
window.DoubleEnterAI = DoubleEnterAI; 