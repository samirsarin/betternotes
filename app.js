// Note-taking app functionality
class NotesApp {
    constructor() {
        this.currentNoteId = null;
        this.notes = [];
        this.aiService = new AIService();
        this.lastEnterTime = 0;
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
            
            // Double tap detection (within 500ms)
            if (timeDiff < 500 && timeDiff > 0) {
                event.preventDefault(); // Prevent second enter
                await this.improveTextWithAI();
            }
            
            this.lastEnterTime = currentTime;
        }
    }

    async improveTextWithAI() {
        if (!this.aiService.isAvailable()) {
            this.showSaveStatus('AI is busy, please wait...', 'loading');
            return;
        }

        const textarea = this.noteContent;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        
        // Find the last double newline or start of text
        const lastDoubleNewline = textBeforeCursor.lastIndexOf('\n\n');
        const textToImprove = lastDoubleNewline !== -1 
            ? textBeforeCursor.substring(lastDoubleNewline + 2)
            : textBeforeCursor;

        if (!textToImprove.trim()) {
            this.showSaveStatus('No text to improve', 'error');
            return;
        }

        try {
            this.showSaveStatus('🤖 AI is improving your text...', 'loading');
            
            const improvedText = await this.aiService.improveText(textToImprove);
            
            if (improvedText && improvedText.trim()) {
                // Replace the text before cursor with improved version
                const beforeImprovement = lastDoubleNewline !== -1 
                    ? textarea.value.substring(0, lastDoubleNewline + 2)
                    : '';
                const afterCursor = textarea.value.substring(cursorPos);
                
                // Insert improved text
                textarea.value = beforeImprovement + improvedText + '\n\n' + afterCursor;
                
                // Position cursor after improved text
                const newCursorPos = beforeImprovement.length + improvedText.length + 2;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                
                // Auto-save the improved note
                if (this.currentNoteId) {
                    await this.saveCurrentNote(true);
                }
                
                this.showSaveStatus('✨ Text improved by AI!', 'success');
                setTimeout(() => this.showSaveStatus(''), 3000);
            } else {
                this.showSaveStatus('AI couldn\'t improve this text', 'error');
            }
            
        } catch (error) {
            console.error('AI improvement failed:', error);
            this.showSaveStatus('AI improvement failed. Try again later.', 'error');
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
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