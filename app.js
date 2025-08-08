// Note-taking app functionality
class NotesApp {
    constructor() {
        this.currentNoteId = null;
        this.notes = [];
        this.aiService = new AIService();
        this.editor = null; // TipTap editor instance
        this.initializeElements();
        this.attachEventListeners();
        this.loadNotes();
    }

    initializeElements() {
        this.newNoteBtn = document.getElementById('newNoteBtn');
        this.deleteNoteBtn = document.getElementById('deleteNoteBtn');
        this.saveNoteBtn = document.getElementById('saveNoteBtn');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteContent = document.getElementById('noteContent'); // Hidden, for compatibility
        this.tiptapContainer = document.getElementById('tiptap-editor');
        this.notesList = document.getElementById('notesList');
        this.editorArea = document.getElementById('editorArea');
        this.welcomeMessage = document.getElementById('welcomeMessage');
        this.saveStatus = document.getElementById('saveStatus');
        
        // Initialize TipTap Editor
        this.initializeTipTapEditor();
    }

        initializeTipTapEditor() {
        console.log('Initializing rich text editor...');
        
        // Set up contenteditable div with rich text features
        this.tiptapContainer.contentEditable = true;
        this.tiptapContainer.style.outline = 'none';
        this.tiptapContainer.setAttribute('data-placeholder', 'Start typing your note... (Double-tap Enter to improve with AI)');
        
        // Add placeholder styling when empty
        this.updatePlaceholder();
        
        // Add event listeners
        this.tiptapContainer.addEventListener('input', () => {
            this.updatePlaceholder();
            this.scheduleAutoSave();
            this.noteContent.value = this.tiptapContainer.innerHTML;
        });
        
        this.tiptapContainer.addEventListener('focus', () => {
            this.updatePlaceholder();
        });
        
        this.tiptapContainer.addEventListener('blur', () => {
            this.updatePlaceholder();
        });
        
        // Add double-enter detection for AI improvement
        this.addDoubleEnterDetection();
        
        // Add keyboard shortcuts for formatting
        this.addKeyboardShortcuts();
        
        console.log('Rich text editor initialized successfully');
    }
    
    updatePlaceholder() {
        const isEmpty = !this.tiptapContainer.textContent.trim();
        this.tiptapContainer.classList.toggle('is-empty', isEmpty);
    }
    
    addDoubleEnterDetection() {
        let lastEnterTime = 0;
        
        this.tiptapContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const now = Date.now();
                const timeDiff = now - lastEnterTime;
                
                console.log('Enter pressed. Time diff:', timeDiff, 'ms');
                
                // Double-tap detection (within 800ms but more than 50ms to avoid accidental)
                if (timeDiff < 800 && timeDiff > 50) {
                    console.log('Double Enter detected! Triggering AI improvement...');
                    e.preventDefault();
                    this.handleDoubleEnterAI();
                    lastEnterTime = 0;
                    return;
                }
                
                lastEnterTime = now;
            }
        });
    }
    
    addKeyboardShortcuts() {
        this.tiptapContainer.addEventListener('keydown', (e) => {
            // Bold: Ctrl/Cmd + B
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold');
            }
            
            // Italic: Ctrl/Cmd + I
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic');
            }
            
            // Underline: Ctrl/Cmd + U
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                document.execCommand('underline');
            }
        });
    }

    initializeFallbackEditor() {
        console.log('Initializing fallback editor...');
        this.tiptapContainer.contentEditable = true;
        this.tiptapContainer.style.outline = 'none';
        this.tiptapContainer.setAttribute('data-placeholder', 'Start typing your note... (Double-tap Enter to improve with AI)');
        
        // Add basic event listeners
        this.tiptapContainer.addEventListener('input', () => {
            this.scheduleAutoSave();
            this.noteContent.value = this.tiptapContainer.innerHTML;
        });
        
        // Add double-enter detection
        let lastEnterTime = 0;
        this.tiptapContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const now = Date.now();
                const timeDiff = now - lastEnterTime;
                
                if (timeDiff < 800 && timeDiff > 50) {
                    e.preventDefault();
                    this.handleDoubleEnterFallback();
                }
                lastEnterTime = now;
            }
        });
    }
    
    async handleDoubleEnterFallback() {
        const content = this.tiptapContainer.textContent || '';
        if (!content.trim()) return;
        
        try {
            this.showSaveStatus('🤖 AI is improving your text...', 'loading');
            const response = await this.aiService.improveText(content);
            const improvedText = response.generated_text || response.improvedText;
            
            if (improvedText && improvedText.trim()) {
                this.tiptapContainer.innerHTML = `<p>${improvedText.replace(/\n/g, '</p><p>')}</p>`;
                this.noteContent.value = this.tiptapContainer.innerHTML;
                
                if (this.currentNoteId) {
                    await this.saveCurrentNote(true);
                }
                
                this.showSaveStatus('✨ Text improved by AI!', 'success');
                setTimeout(() => this.showSaveStatus(''), 3000);
            }
        } catch (error) {
            console.error('AI improvement failed:', error);
            this.showSaveStatus('AI improvement failed', 'error');
        }
    }

    attachEventListeners() {
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());
        this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
        this.saveNoteBtn.addEventListener('click', () => this.saveCurrentNote());
        
        // Auto-save on title change
        this.noteTitle.addEventListener('input', () => this.scheduleAutoSave());
    }

    scheduleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if (this.currentNoteId) {
                this.saveCurrentNote(true);
            }
        }, 1000);
    }

    async loadNotes() {
        try {
            this.showSaveStatus('Loading notes...', 'loading');
            
            const snapshot = await db.collection('notes')
                .orderBy('updatedAt', 'desc')
                .get();
            
            this.notes = [];
            snapshot.forEach(doc => {
                this.notes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.renderNotesList();
            this.showSaveStatus('');
            
            if (this.notes.length === 0) {
                this.showWelcome();
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showSaveStatus('Error loading notes', 'error');
        }
    }

    async createNewNote() {
        try {
            this.showSaveStatus('Creating new note...', 'loading');
            
            const newNote = {
                title: 'Untitled Note',
                content: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('notes').add(newNote);
            
            const noteWithId = {
                id: docRef.id,
                title: 'Untitled Note',
                content: '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            this.notes.unshift(noteWithId);
            this.renderNotesList();
            this.selectNote(docRef.id);
            this.showSaveStatus('New note created', 'success');
            
            // Focus on title input
            this.noteTitle.focus();
            this.noteTitle.select();
        } catch (error) {
            console.error('Error creating note:', error);
            this.showSaveStatus('Error creating note', 'error');
        }
    }

    async deleteCurrentNote() {
        if (!this.currentNoteId) return;
        
        if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            return;
        }

        try {
            this.showSaveStatus('Deleting note...', 'loading');
            
            await db.collection('notes').doc(this.currentNoteId).delete();
            
            // Remove from local array
            this.notes = this.notes.filter(note => note.id !== this.currentNoteId);
            
            this.renderNotesList();
            this.showWelcome();
            this.currentNoteId = null;
            this.showSaveStatus('Note deleted', 'success');
        } catch (error) {
            console.error('Error deleting note:', error);
            this.showSaveStatus('Error deleting note', 'error');
        }
    }

    async saveCurrentNote(isAutoSave = false) {
        if (!this.currentNoteId) return;

        const title = this.noteTitle.value.trim() || 'Untitled Note';
        const content = this.tiptapContainer.innerHTML;

        try {
            if (!isAutoSave) {
                this.showSaveStatus('Saving...', 'loading');
            }
            
            await db.collection('notes').doc(this.currentNoteId).update({
                title: title,
                content: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local array
            const noteIndex = this.notes.findIndex(note => note.id === this.currentNoteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex].title = title;
                this.notes[noteIndex].content = content;
                this.notes[noteIndex].updatedAt = new Date();
            }

            this.renderNotesList();
            
            if (isAutoSave) {
                this.showSaveStatus('Auto-saved', 'success');
                setTimeout(() => this.showSaveStatus(''), 2000);
            } else {
                this.showSaveStatus('Note saved!', 'success');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.showSaveStatus('Error saving note', 'error');
        }
    }

    selectNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.currentNoteId = noteId;
        this.noteTitle.value = note.title;
        
        // Set content in the rich text editor
        this.tiptapContainer.innerHTML = note.content || '';
        
        // Update hidden textarea for compatibility
        this.noteContent.value = note.content || '';
        
        // Update placeholder state
        this.updatePlaceholder();
        
        this.showEditor();
        this.updateActiveNote();
    }

    renderNotesList() {
        if (this.notes.length === 0) {
            this.notesList.innerHTML = `
                <div class="empty-state">
                    <p>No notes yet. Create your first note!</p>
                </div>
            `;
            return;
        }

        const notesHTML = this.notes.map(note => {
            const preview = note.content.substring(0, 100) || 'No content...';
            const date = this.formatDate(note.updatedAt);
            
            return `
                <div class="note-item" data-note-id="${note.id}">
                    <div class="note-item-title">${this.escapeHtml(note.title)}</div>
                    <div class="note-item-preview">${this.escapeHtml(preview)}</div>
                    <div class="note-item-date">${date}</div>
                </div>
            `;
        }).join('');

        this.notesList.innerHTML = notesHTML;

        // Add click listeners to note items
        this.notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.selectNote(noteId);
            });
        });
    }

    updateActiveNote() {
        this.notesList.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.noteId === this.currentNoteId) {
                item.classList.add('active');
            }
        });
    }

    showWelcome() {
        this.editorArea.style.display = 'none';
        this.welcomeMessage.style.display = 'flex';
        this.deleteNoteBtn.style.display = 'none';
    }

    showEditor() {
        this.editorArea.style.display = 'flex';
        this.welcomeMessage.style.display = 'none';
        this.deleteNoteBtn.style.display = 'inline-flex';
    }

    showSaveStatus(message, type = '') {
        this.saveStatus.textContent = message;
        this.saveStatus.className = `save-status ${type}`;
    }

    formatDate(date) {
        if (!date) return '';
        
        const d = date.toDate ? date.toDate() : new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - d);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return 'Today';
        } else if (diffDays === 2) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays - 1} days ago`;
        } else {
            return d.toLocaleDateString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async handleKeyDown(event) {
        if (event.key === 'Enter') {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastEnterTime;
            
            console.log('Enter pressed. Time diff:', timeDiff, 'ms');
            
            // Double tap detection (within 800ms but more than 50ms to avoid accidental)
            if (timeDiff < 800 && timeDiff > 50) {
                console.log('Double Enter detected! Triggering AI improvement...');
                event.preventDefault(); // Prevent second enter
                await this.improveTextWithAI();
            }
            
            this.lastEnterTime = currentTime;
        }
    }

    async handleDoubleEnterAI() {
        console.log('=== AI Improvement Started ===');
        
        if (!this.aiService.isAvailable()) {
            console.log('AI service not available');
            this.showSaveStatus('AI is busy, please wait...', 'loading');
            return;
        }

        // Get the current content from the editor
        const currentContent = this.tiptapContainer.textContent || '';
        
        console.log('Current editor content:', currentContent);

        if (!currentContent.trim()) {
            console.log('No text to improve - empty content');
            this.showSaveStatus('No text to improve', 'error');
            return;
        }

        try {
            this.showSaveStatus('🤖 AI is improving your text...', 'loading');
            
            console.log('Calling AI service with text:', currentContent);
            const response = await this.aiService.improveText(currentContent);
            console.log('AI service response:', response);
            
            const improvedText = response.generated_text || response.improvedText;
            console.log('Improved text received:', improvedText);
            
            if (improvedText && improvedText.trim()) {
                console.log('AI improvement successful. Replacing content...');
                
                // Convert improved markdown text to HTML and replace content
                const htmlContent = this.convertMarkdownToHTML(improvedText);
                this.tiptapContainer.innerHTML = htmlContent;
                
                // Update hidden textarea for compatibility
                this.noteContent.value = htmlContent;
                
                // Update placeholder state
                this.updatePlaceholder();
                
                // Auto-save the improved note
                if (this.currentNoteId) {
                    console.log('Auto-saving note...');
                    await this.saveCurrentNote(true);
                }
                
                this.showSaveStatus('✨ Text improved by AI!', 'success');
                setTimeout(() => this.showSaveStatus(''), 3000);
            } else {
                console.log('Empty or invalid AI response. Received:', improvedText);
                this.showSaveStatus('AI couldn\'t improve this text', 'error');
            }
            
        } catch (error) {
            console.error('AI improvement failed:', error);
            
            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                this.showSaveStatus('Connection failed. Check internet connection.', 'error');
            } else if (error.message.includes('403')) {
                this.showSaveStatus('API key invalid or quota exceeded.', 'error');
            } else if (error.message.includes('429')) {
                this.showSaveStatus('Rate limit exceeded. Wait a moment.', 'error');
            } else {
                this.showSaveStatus(`AI error: ${error.message}`, 'error');
            }
        }
    }

    convertMarkdownToHTML(text) {
        // Convert markdown-style formatting to HTML
        return text
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold and italic combinations
            .replace(/\*\*\*_(.+?)_\*\*\*/g, '<strong><u>$1</u></strong>')
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong>$1</strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Convert bullet points to HTML lists
            .replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>')
            // Wrap consecutive <li> tags in <ul>
            .replace(/(<li>.*<\/li>(?:\s*<li>.*<\/li>)*)/gs, '<ul>$1</ul>')
            // Convert double newlines to paragraph breaks
            .replace(/\n\n/g, '</p><p>')
            // Wrap everything in paragraphs if not already wrapped
            .replace(/^(?!<[hul])/gm, '<p>')
            .replace(/(?<!>)$/gm, '</p>')
            // Clean up empty paragraphs and fix formatting
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<[hul])/g, '$1')
            .replace(/(<\/[hul]>)<\/p>/g, '$1');
    }

    // Keep old method for compatibility
    async improveTextWithAI() {
        console.log('=== AI Improvement Started ===');
        
        if (!this.aiService.isAvailable()) {
            console.log('AI service not available');
            this.showSaveStatus('AI is busy, please wait...', 'loading');
            return;
        }

        const textarea = this.noteContent;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        
        console.log('Cursor position:', cursorPos);
        console.log('Text before cursor:', textBeforeCursor.substring(0, 100) + '...');
        
        // Find the last double newline or start of text
        const lastDoubleNewline = textBeforeCursor.lastIndexOf('\n\n');
        const textToImprove = lastDoubleNewline !== -1 
            ? textBeforeCursor.substring(lastDoubleNewline + 2)
            : textBeforeCursor;

        console.log('Text to improve:', textToImprove);

        if (!textToImprove.trim()) {
            console.log('No text to improve - empty or whitespace only');
            this.showSaveStatus('No text to improve', 'error');
            return;
        }

        try {
            this.showSaveStatus('🤖 AI is improving your text...', 'loading');
            
            console.log('Attempting to improve text:', textToImprove.substring(0, 100) + '...');
            
            let improvedText;
            
            // Use Gemini AI to improve text
            improvedText = await this.aiService.improveText(textToImprove);
            console.log('Gemini AI response received:', improvedText ? 'Success' : 'Empty response');
            
            if (improvedText && improvedText.trim()) {
                console.log('AI improvement successful. Improved text:', improvedText);
                
                // Replace the text before cursor with improved version
                const beforeImprovement = lastDoubleNewline !== -1 
                    ? textarea.value.substring(0, lastDoubleNewline + 2)
                    : '';
                const afterCursor = textarea.value.substring(cursorPos);
                
                console.log('Before improvement:', beforeImprovement.length, 'chars');
                console.log('After cursor:', afterCursor.length, 'chars');
                
                // Insert improved text
                const newText = beforeImprovement + improvedText + '\n\n' + afterCursor;
                console.log('Setting new textarea value. Length:', newText.length);
                textarea.value = newText;
                
                // Convert the improved text to HTML and display it
                this.renderFormattedContent();
                
                // Force show the formatted view after AI improvement with academic styling
                console.log('Showing formatted academic notes after AI improvement');
                this.showFormattedView();
                
                // Ensure consistent academic formatting
                setTimeout(() => {
                    this.showFormattedView();
                }, 100);
                
                // Position cursor after improved text
                const newCursorPos = beforeImprovement.length + improvedText.length + 2;
                console.log('Setting cursor to position:', newCursorPos);
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                
                // Auto-save the improved note
                if (this.currentNoteId) {
                    console.log('Auto-saving note...');
                    await this.saveCurrentNote(true);
                }
                
                this.showSaveStatus('✨ Text improved by AI!', 'success');
                setTimeout(() => this.showSaveStatus(''), 3000);
            } else {
                console.log('Empty or invalid AI response. Received:', improvedText);
                this.showSaveStatus('AI couldn\'t improve this text', 'error');
            }
            
        } catch (error) {
            console.error('AI improvement failed:', error);
            
            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                this.showSaveStatus('Connection failed. Check internet connection.', 'error');
            } else if (error.message.includes('403')) {
                this.showSaveStatus('API key invalid or quota exceeded.', 'error');
            } else if (error.message.includes('429')) {
                this.showSaveStatus('Rate limit exceeded. Wait a moment.', 'error');
            } else {
                this.showSaveStatus(`AI error: ${error.message}`, 'error');
            }
                }
    }

    renderFormattedContent() {
        const content = this.noteContent.value;
        if (content.trim()) {
            console.log('Original content for rendering:', content);
            
            // Ensure the element exists before rendering
            if (!this.noteContentFormatted) {
                console.error('noteContentFormatted element not found, reinitializing...');
                this.noteContentFormatted = document.getElementById('noteContentFormatted');
            }
            
                         // Use markdown renderer for consistent college-level formatting
             console.log('Rendering with MarkdownRenderer for academic formatting');
             this.markdownRenderer.renderMarkdown(content, this.noteContentFormatted);
            
            console.log('Raw content being rendered:', JSON.stringify(content));
            console.log('Content character codes:', Array.from(content).map(c => c.charCodeAt(0)));
            
        } else {
            if (this.noteContentFormatted) {
                this.noteContentFormatted.textContent = '';
            }
        }
    }

    renderAsHTML(content) {
        // First, convert markdown-style formatting to HTML
        let processedContent = this.convertMarkdownToHTML(content);
        
        // Split by double newlines and create paragraphs
        let paragraphs = processedContent.split(/\n\s*\n+/);
        
        let html = paragraphs
            .map(para => {
                para = para.trim();
                if (!para) return '';
                
                // Handle bullet points
                if (para.includes('•') || para.includes('*') && para.includes('</')) {
                    let lines = para.split('\n');
                    let listItems = lines
                        .filter(line => line.trim())
                        .map(line => {
                            if (line.includes('•') || line.trim().startsWith('*')) {
                                let text = line.replace(/^[•\*\s]*/, '').trim();
                                return `<li>${text}</li>`;
                            } else {
                                return `<p>${line.trim()}</p>`;
                            }
                        });
                    
                    return `<ul>${listItems.join('')}</ul>`;
                } else {
                    // Regular paragraph
                    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
                }
            })
            .filter(p => p)
            .join('');
            
        this.noteContentFormatted.innerHTML = html;
        console.log('Formatted HTML rendered:', html);
    }
    
    convertMarkdownToHTML(text) {
        console.log('Converting markdown:', text);
        
        let converted = text
            // Handle complex nested formatting first
            // ***_text_*** -> bold + underline
            .replace(/\*\*\*_([^_*]+)_\*\*\*/g, '<strong><u>$1</u></strong>')
            
            // ***text*** -> bold
            .replace(/\*\*\*([^*_]+)\*\*\*/g, '<strong>$1</strong>')
            
            // **text** -> bold
            .replace(/\*\*([^*_]+)\*\*\*/g, '<strong>$1</strong>')
            
            // _text_ -> italic/emphasis
            .replace(/_([^_*]+)_/g, '<em>$1</em>')
            
            // Single * for lists (preserve these)
            .replace(/^\s*\*\s+/gm, '• ')
            
            // Clean up remaining asterisks that aren't formatting
            .replace(/\*+([^*<>]*)\*+/g, '<strong>$1</strong>')
            .replace(/\*{3,}/g, '');
            
        console.log('Converted to:', converted);
        return converted;
    }

    renderWithShowdownFallback(content) {
        try {
            if (this.markdownConverter && this.noteContentFormatted) {
                console.log('Using Showdown fallback renderer...');
                const processedContent = this.preprocessMarkdown(content);
                const html = this.markdownConverter.makeHtml(processedContent);
                this.noteContentFormatted.innerHTML = html;
            } else {
                console.log('Using basic text rendering...');
                // Last resort: basic text with line breaks
                this.noteContentFormatted.innerHTML = content
                    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                    .replace(/^\- (.*$)/gm, '<li>$1</li>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.error('All rendering methods failed:', error);
            if (this.noteContentFormatted) {
                this.noteContentFormatted.innerHTML = '<p class="error">Error rendering content</p>';
            }
        }
    }

    preprocessMarkdown(content) {
        let processed = content;
        
        // Ensure headers have proper spacing
        processed = processed.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2\n');
        
        // Ensure bullet points start on new lines
        processed = processed.replace(/([^\n])\s*(-\s*)/g, '$1\n\n$2');
        
        // Fix inline bullet points
        processed = processed.replace(/(-\s*[^-\n]+)\s+(-\s*)/g, '$1\n$2');
        
        // Ensure proper line breaks after headers
        processed = processed.replace(/^(#{1,6}\s*.+)(?!\n\n)/gm, '$1\n');
        
        // Clean up excessive whitespace but preserve intentional breaks
        processed = processed.replace(/\n{4,}/g, '\n\n\n');
        
        return processed;
    }

    convertFormattedToPlainText() {
        // Convert HTML back to clean text for editing
        if (this.noteContentFormatted && this.noteContentFormatted.innerHTML.trim()) {
            // Get the text content and clean it up
            let plainText = this.noteContentFormatted.textContent || this.noteContentFormatted.innerText;
            
            // Clean up extra whitespace while preserving structure
            plainText = plainText
                .replace(/\n\s*\n\s*\n/g, '\n\n')  // Reduce excessive line breaks
                .replace(/^\s+|\s+$/g, '')          // Trim
                .replace(/[ \t]+$/gm, '');          // Remove trailing spaces
            
            this.noteContent.value = plainText;
            console.log('Converted HTML content to editable text:', plainText);
        }
    }

    showPlainTextView() {
        this.noteContent.style.display = 'block';
        this.noteContent.style.position = 'absolute';
        this.noteContent.style.top = '0';
        this.noteContent.style.left = '0';
        this.noteContent.style.right = '0';
        this.noteContent.style.bottom = '0';
        this.noteContentFormatted.style.display = 'none';
    }

    showFormattedView() {
        this.renderFormattedContent();
        this.noteContent.style.display = 'none';
        this.noteContentFormatted.style.display = 'block';
    }

         maybeShowFormattedView() {
         // Always show formatted view for consistency
         this.showFormattedView();
     }

 
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Debug: Check what libraries are available
    console.log('Libraries check:', {
        firebase: typeof firebase !== 'undefined',
        marked: typeof marked !== 'undefined',
        DOMPurify: typeof DOMPurify !== 'undefined',
        showdown: typeof showdown !== 'undefined'
    });

    // Check if Firebase is initialized
    if (typeof firebase === 'undefined') {
        document.body.innerHTML = `
            <div class="container">
                <div class="error">
                    <h2>Firebase not loaded</h2>
                    <p>Please check your internet connection and Firebase configuration.</p>
                </div>
            </div>
        `;
        return;
    }

    // Initialize the app
    window.notesApp = new NotesApp();
}); 