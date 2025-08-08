// Note-taking app functionality
class NotesApp {
    constructor() {
        this.currentNoteId = null;
        this.notes = [];
        this.aiService = new AIService();
        this.lastEnterTime = 0;
        
        // Initialize enhanced markdown renderer (primary)
        try {
            this.markdownRenderer = new MarkdownRenderer();
            console.log('MarkdownRenderer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MarkdownRenderer:', error);
            this.markdownRenderer = null;
        }
        
        // Keep Showdown as backup (for backward compatibility)
        this.markdownConverter = new showdown.Converter({
            headerLevelStart: 1,
            simplifiedAutoLink: true,
            strikethrough: true,
            tables: true,
            tasklists: true,
            smartIndentationFix: true,
            simpleLineBreaks: true,
            openLinksInNewWindow: true,
            breaks: true,
            ghCodeBlocks: true,
            smoothLivePreview: true
        });
        this.initializeElements();
        this.attachEventListeners();
        this.loadNotes();
    }

    initializeElements() {
        this.newNoteBtn = document.getElementById('newNoteBtn');
        this.deleteNoteBtn = document.getElementById('deleteNoteBtn');
        this.saveNoteBtn = document.getElementById('saveNoteBtn');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteContent = document.getElementById('noteContent');
        this.noteContentFormatted = document.getElementById('noteContentFormatted');
        this.notesList = document.getElementById('notesList');
        this.editorArea = document.getElementById('editorArea');
        this.welcomeMessage = document.getElementById('welcomeMessage');
        this.saveStatus = document.getElementById('saveStatus');
    }

    attachEventListeners() {
        this.newNoteBtn.addEventListener('click', () => this.createNewNote());
        this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
        this.saveNoteBtn.addEventListener('click', () => this.saveCurrentNote());
        
        // Auto-save on typing (with debounce)
        let saveTimeout;
        const autoSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (this.currentNoteId) {
                    this.saveCurrentNote(true);
                }
            }, 1000);
        };
        
        this.noteTitle.addEventListener('input', autoSave);
        this.noteContent.addEventListener('input', autoSave);
        
        // AI improvement on double Enter
        this.noteContent.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Add toggle functionality for formatted view
        this.noteContent.addEventListener('focus', () => this.showPlainTextView());
        this.noteContent.addEventListener('blur', () => {
            // Small delay to allow for clicking within the editor
            setTimeout(() => this.maybeShowFormattedView(), 100);
        });
        
        // Click on formatted view to start editing
        this.noteContentFormatted.addEventListener('click', () => {
            // Convert the current formatted content back to clean text for editing
            this.convertFormattedToPlainText();
            this.showPlainTextView();
            this.noteContent.focus();
        });
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
        const content = this.noteContent.value;

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
        this.noteContent.value = note.content;
        
        // Render formatted content
        this.renderFormattedContent();
        
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
            
            // With white-space: pre-wrap CSS, we can just use the text directly
            // The CSS will preserve all the AI's formatting, newlines, and indentation
            this.noteContentFormatted.textContent = content;
            console.log('Rendered content with preserved formatting');
            console.log('Raw content being rendered:', JSON.stringify(content));
            console.log('Content character codes:', Array.from(content).map(c => c.charCodeAt(0)));
            
        } else {
            if (this.noteContentFormatted) {
                this.noteContentFormatted.textContent = '';
            }
        }
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
        // Since we're now using textContent instead of innerHTML, 
        // and the formatting is preserved with CSS, we can just copy the text directly
        if (this.noteContentFormatted && this.noteContentFormatted.textContent.trim()) {
            // The textContent already contains the properly formatted text with newlines and indentation
            this.noteContent.value = this.noteContentFormatted.textContent;
            console.log('Converted formatted content to editable text:', this.noteContentFormatted.textContent);
        }
    }

    showPlainTextView() {
        this.noteContent.style.display = 'block';
        this.noteContentFormatted.style.display = 'none';
    }

    showFormattedView() {
        this.renderFormattedContent();
        this.noteContent.style.display = 'none';
        this.noteContentFormatted.style.display = 'block';
    }

    maybeShowFormattedView() {
        // Only show formatted view if not actively editing
        if (document.activeElement !== this.noteContent) {
            this.showFormattedView();
        }
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