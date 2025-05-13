document.addEventListener('DOMContentLoaded', function() {
    const codeEditor = document.getElementById('code-editor');
    const highlightLayer = document.querySelector('#highlight-layer code');
    const lineNumbers = document.getElementById('line-numbers');
    const output = document.getElementById('output');
    const runBtn = document.getElementById('run-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const clearOutputBtn = document.getElementById('clear-output-btn');
    const copyBtn = document.getElementById('copy-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const codeTitle = document.getElementById('code-title');
    const saveStatus = document.getElementById('save-status');
    const resizer = document.getElementById('resizer');
    const clearConsoleBtn = document.getElementById('clear-console-btn');

    let editorHistory = [];
    let historyIndex = -1;
    let isEditorDirty = false;
    let currentCodeId = null;
    let lastSavedContent = '';

    const hljs = window.hljs;

    if (codeEditor && lineNumbers && highlightLayer) {
        highlightLayer.style.background = "transparent";
        
        
        updateLineNumbers();
        updateHighlighting();
        
        saveToHistory();

        codeEditor.addEventListener('input', function() {
            updateHighlighting();
            updateLineNumbers();
            markEditorDirty();
        });

        codeEditor.addEventListener('scroll', function() {
            if (highlightLayer && highlightLayer.parentElement) {
                highlightLayer.parentElement.scrollTop = codeEditor.scrollTop;
                highlightLayer.parentElement.scrollLeft = codeEditor.scrollLeft;
            }
            if (lineNumbers) {
                lineNumbers.scrollTop = codeEditor.scrollTop;
            }
        });

        codeEditor.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                
                this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                
                this.selectionStart = this.selectionEnd = start + 4;
                
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            }
            
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        redo();
                        break;
                    case 's':
                        e.preventDefault();
                        saveCode();
                        break;
                    case 'a':
                        e.preventDefault();
                        selectAll();
                        break;
                }
            }
            
            if (e.key === 'F9') {
                e.preventDefault();
                runCode();
            }
            
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
        });
    }

    if (runBtn) runBtn.addEventListener('click', runCode);
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    if (clearOutputBtn) clearOutputBtn.addEventListener('click', clearOutput);
    if (copyBtn) copyBtn.addEventListener('click', copyCode);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAll);
    if (saveBtn) saveBtn.addEventListener('click', saveCode);
    if (shareBtn) shareBtn.addEventListener('click', showShareModal);
    if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', clearOutput);
    
    if (codeTitle) {
        codeTitle.addEventListener('change', function() {
            markEditorDirty();
        });
    }

   
    function isAuthenticated() {
        return false;
    }

    function showLoginModal() {
        // Replace with your login modal display logic
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'block';
            
            const closeBtn = loginModal.querySelector('.close');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    loginModal.style.display = 'none';
                };
            }
            
            window.onclick = function(event) {
                if (event.target === loginModal) {
                    loginModal.style.display = 'none';
                }
            };
        } else {
            alert('Please log in to save and share code.');
        }
    }

    function updateCodeInDatabase(codeId, title, code) {
        // substituir com a lógica de atualização do banco de dados
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log(`Code with ID ${codeId} updated in the database.`);
                resolve();
            }, 500);
        });
    }

    function saveCodeToDatabase(title, code) {
        // substituir com a lógica de salvamento do banco de dados
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const newCodeId = Math.random().toString(36).substring(2, 15);
                console.log(`Code saved to the database with ID ${newCodeId}.`);
                resolve(newCodeId);
            }, 500);
        });
    }

    function generateShareLink(codeId, permission) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const shareLink = `https://example.com/share/${codeId}?permission=${permission}`;
                console.log(`Share link generated: ${shareLink}`);
                resolve(shareLink);
            }, 500);
        });
    }

    function getSharedCode(shareId) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const sharedCodeData = {
                    code: '// Shared code example',
                    title: 'Shared Code',
                    permission: 'read'
                };
                console.log(`Shared code loaded for ID ${shareId}`);
                resolve(sharedCodeData);
            }, 500);
        });
    }

    function updateHighlighting() {
        if (!highlightLayer || !codeEditor || !hljs) return;
        
        highlightLayer.textContent = codeEditor.value;
        
        hljs.highlightElement(highlightLayer);
        
    }

    function updateLineNumbers() {
        if (!lineNumbers || !codeEditor) return;
        
        const lines = codeEditor.value.split('\n');
        let lineNumbersHTML = '';
        
        for (let i = 0; i < lines.length; i++) {
            lineNumbersHTML += (i + 1) + '\n';
        }
        
        lineNumbers.textContent = lineNumbersHTML;
    }

    function runCode() {
        clearOutput();
        
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        
        try {
            console.log = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => {
                    if (typeof arg === 'object') {
                        return JSON.stringify(arg, null, 2);
                    }
                    return String(arg);
                }).join(' ');
                
                appendToOutput(message, 'log');
                originalLog.apply(console, arguments);
            };
            
            console.error = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'error');
                originalError.apply(console, arguments);
            };
            
            console.warn = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'warn');
                originalWarn.apply(console, arguments);
            };
            
            console.info = function() {
                const args = Array.from(arguments);
                const message = args.map(arg => String(arg)).join(' ');
                appendToOutput(message, 'info');
                originalInfo.apply(console, arguments);
            };
            
            if (!codeEditor) return;
            const code = codeEditor.value;
            const result = eval(code);
            
            if (result !== undefined) {
                let resultStr;
                if (typeof result === 'object') {
                    resultStr = JSON.stringify(result, null, 2);
                } else {
                    resultStr = String(result);
                }
                appendToOutput('=> ' + resultStr, 'result');
            }
        } catch (error) {
            appendToOutput(error.toString(), 'error');
        } finally {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        }
    }

    function appendToOutput(message, type = 'log') {
        if (!output) return;
        
        const line = document.createElement('div');
        line.className = 'output-line ' + type;
        line.textContent = message;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    function clearOutput() {
        if (!output) return;
        output.innerHTML = '';
    }

    function saveToHistory() {
        if (!codeEditor) return;
        
        if (historyIndex < editorHistory.length - 1) {
            editorHistory = editorHistory.slice(0, historyIndex + 1);
        }
        
        editorHistory.push(codeEditor.value);
        historyIndex = editorHistory.length - 1;
        
        if (editorHistory.length > 100) {
            editorHistory.shift();
            historyIndex--;
        }
        
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            if (codeEditor) {
                codeEditor.value = editorHistory[historyIndex];
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            }
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (historyIndex < editorHistory.length - 1) {
            historyIndex++;
            if (codeEditor) {
                codeEditor.value = editorHistory[historyIndex];
                updateHighlighting();
                updateLineNumbers();
                markEditorDirty();
            }
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        if (!undoBtn || !redoBtn) return;
        
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= editorHistory.length - 1;
        
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    function copyCode() {
        if (!codeEditor) return;
        
        codeEditor.select();
        document.execCommand('copy');
        
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = 'Code copied to clipboard!';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 2000);
    }

    function toggleFullscreen() {
        const editorContainer = document.querySelector('.editor-container');
        
        if (!document.fullscreenElement) {
            if (editorContainer) {
                editorContainer.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            }
        } else {
            document.exitFullscreen();
        }
    }

    function selectAll() {
        if (!codeEditor) return;
        codeEditor.select();
    }

    function markEditorDirty() {
        if (!codeEditor || !saveStatus) return;
        
        if (lastSavedContent !== codeEditor.value) {
            isEditorDirty = true;
            saveStatus.textContent = 'Unsaved';
            saveStatus.style.color = '#e74c3c';
        } else {
            isEditorDirty = false;
            saveStatus.textContent = 'Saved';
            saveStatus.style.color = '#888';
        }
        
        clearTimeout(window.historySaveTimeout);
        window.historySaveTimeout = setTimeout(saveToHistory, 500);
    }

    function saveCode() {
        if (!isAuthenticated()) {
            showLoginModal();
            return;
        }
        
        if (!codeEditor || !codeTitle) return;
        
        const title = codeTitle.value || 'Untitled.js';
        const code = codeEditor.value;
        
        if (currentCodeId) {
            updateCodeInDatabase(currentCodeId, title, code)
                .then(() => {
                    lastSavedContent = code;
                    isEditorDirty = false;
                    if (saveStatus) {
                        saveStatus.textContent = 'Saved';
                        saveStatus.style.color = '#888';
                    }
                })
                .catch(error => {
                    console.error('Error saving code:', error);
                    alert('Failed to save code. Please try again.');
                });
        } else {
            saveCodeToDatabase(title, code)
                .then(codeId => {
                    currentCodeId = codeId;
                    lastSavedContent = code;
                    isEditorDirty = false;
                    if (saveStatus) {
                        saveStatus.textContent = 'Saved';
                        saveStatus.style.color = '#888';
                    }
                })
                .catch(error => {
                    console.error('Error saving code:', error);
                    alert('Failed to save code. Please try again.');
                });
        }
    }

    function showShareModal() {
        if (!isAuthenticated()) {
            showLoginModal();
            return;
        }
        
        if (!currentCodeId) {
            saveCode();
            setTimeout(showShareModal, 500); 
            return;
        }
        
        const shareModal = document.getElementById('share-modal');
        if (!shareModal) return;
        
        const shareLink = document.getElementById('share-link');
        const generateLinkBtn = document.getElementById('generate-link-btn');
        const copyLinkBtn = document.getElementById('copy-link-btn');
        const shareSuccess = document.getElementById('share-success');
        
        if (!shareLink || !generateLinkBtn || !copyLinkBtn || !shareSuccess) return;
        
        shareLink.value = '';
        shareSuccess.textContent = '';
        
        shareModal.style.display = 'block';
        
        generateLinkBtn.onclick = function() {
            const permissionInput = document.querySelector('input[name="permission"]:checked');
            if (!permissionInput) return;
            
            const permission = permissionInput.value;
            
            generateShareLink(currentCodeId, permission)
                .then(link => {
                    shareLink.value = link;
                    shareSuccess.textContent = 'Share link generated successfully!';
                })
                .catch(error => {
                    console.error('Error generating share link:', error);
                    shareSuccess.textContent = 'Failed to generate share link. Please try again.';
                    shareSuccess.style.color = 'var(--error-color)';
                });
        };
        
        copyLinkBtn.onclick = function() {
            shareLink.select();
            document.execCommand('copy');
            shareSuccess.textContent = 'Link copied to clipboard!';
        };
        
        const closeBtn = shareModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                shareModal.style.display = 'none';
            };
        }
        
        window.onclick = function(event) {
            if (event.target === shareModal) {
                shareModal.style.display = 'none';
            }
        };
    }

    function loadSharedCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');
        
        if (shareId) {
            getSharedCode(shareId)
                .then(data => {
                    if (!codeEditor || !codeTitle) return;
                    
                    codeEditor.value = data.code;
                    codeTitle.value = data.title;
                    updateHighlighting();
                    updateLineNumbers();
                    
                    if (data.permission === 'read') {
                        codeEditor.readOnly = true;
                        codeEditor.style.opacity = '0.8';
                        codeTitle.readOnly = true;
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.style.opacity = '0.5';
                        }
                    } else {
                        currentCodeId = null;
                        lastSavedContent = '';
                        markEditorDirty();
                    }
                })
                .catch(error => {
                    console.error('Error loading shared code:', error);
                    alert('Failed to load shared code. The link may be invalid or expired.');
                });
        }
    }

    let isResizing = false;
    let lastX, lastY;
    
    if (resizer) {
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            lastX = e.clientX;
            lastY = e.clientY;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });
    }
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const codeContainer = document.querySelector('.code-container');
        const outputContainer = document.querySelector('.output-container');
        const editorWorkspace = document.querySelector('.editor-workspace');
        
        if (!codeContainer || !outputContainer || !editorWorkspace) return;
        
        if (window.innerWidth > 768) {
            const deltaX = e.clientX - lastX;
            const codeWidth = codeContainer.getBoundingClientRect().width;
            const outputWidth = outputContainer.getBoundingClientRect().width;
            const totalWidth = editorWorkspace.getBoundingClientRect().width;
            
            const newCodeWidth = codeWidth + deltaX;
            const newOutputWidth = totalWidth - newCodeWidth - (resizer ? resizer.getBoundingClientRect().width : 0);
            
            if (newCodeWidth > 200 && newOutputWidth > 200) {
                codeContainer.style.flex = `0 0 ${newCodeWidth}px`;
                outputContainer.style.width = `${newOutputWidth}px`;
                lastX = e.clientX;
            }
        } else {
            const deltaY = e.clientY - lastY;
            const codeHeight = codeContainer.getBoundingClientRect().height;
            const outputHeight = outputContainer.getBoundingClientRect().height;
            const totalHeight = editorWorkspace.getBoundingClientRect().height;
            
            const newCodeHeight = codeHeight + deltaY;
            const newOutputHeight = totalHeight - newCodeHeight - (resizer ? resizer.getBoundingClientRect().height : 0);
            
            if (newCodeHeight > 150 && newOutputHeight > 150) {
                codeContainer.style.height = `${newCodeHeight}px`;
                outputContainer.style.height = `${newOutputHeight}px`;
                lastY = e.clientY;
            }
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }

    loadSharedCode();
    
    window.editorFunctions = {
        loadCode: function(id, title, code) {
            currentCodeId = id;
            if (codeTitle) codeTitle.value = title;
            if (codeEditor) codeEditor.value = code;
            lastSavedContent = code;
            updateHighlighting();
            updateLineNumbers();
            isEditorDirty = false;
            if (saveStatus) {
                saveStatus.textContent = 'Saved';
                saveStatus.style.color = '#888';
            }
            
            editorHistory = [code];
            historyIndex = 0;
            updateUndoRedoButtons();
        },
        
        newCode: function() {
            currentCodeId = null;
            if (codeTitle) codeTitle.value = 'Untitled.js';
            if (codeEditor) codeEditor.value = '// Write your JavaScript code here\nconsole.log("Hello, world!");';
            lastSavedContent = '';
            updateHighlighting();
            updateLineNumbers();
            markEditorDirty();
            
            editorHistory = [codeEditor.value];
            historyIndex = 0;
            updateUndoRedoButtons();
        }
    };
});