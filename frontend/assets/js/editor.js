document.addEventListener('DOMContentLoaded', function() {
    // ========================================
    // ELEMENTOS DOM
    // ========================================
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
    const userInfo = document.getElementById('user-info');
    const authButtons = document.getElementById('auth-buttons');
    const usernameDisplay = document.getElementById('username-display');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const profileBtn = document.getElementById('profile-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // ========================================
    // VARIÁVEIS GLOBAIS
    // ========================================
    let editorHistory = [];
    let historyIndex = -1;
    let isEditorDirty = false;
    let currentCodeId = null;
    let lastSavedContent = '';
    let currentUser = null;
    let authToken = localStorage.getItem('auth_token');
    let currentPage = 1;
    let searchQuery = '';
    const hljs = window.hljs;
    const API_BASE = '/api';

    // ========================================
    // FUNÇÕES DE AUTENTICAÇÃO
    // ========================================
    async function checkAuth() {
        if (!authToken) {
            showLoggedOutState();
            return false;
        }
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            const data = await response.json();
            if (data.success) {
                currentUser = data.data.user;
                showLoggedInState();
                return true;
            } else {
                authToken = null;
                localStorage.removeItem('auth_token');
                showLoggedOutState();
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            showLoggedOutState();
            return false;
        }
    }

    function showLoggedInState() {
        if (userInfo && authButtons && usernameDisplay) {
            usernameDisplay.textContent = currentUser.username;
            userInfo.classList.remove('hidden');
            authButtons.classList.add('hidden');
        }
    }

    function showLoggedOutState() {
        if (userInfo && authButtons) {
            userInfo.classList.add('hidden');
            authButtons.classList.remove('hidden');
        }
        currentUser = null;
    }

    function logout() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('auth_token');
        showLoggedOutState();
        showNotification('Logout realizado com sucesso!');
        currentCodeId = null;
        lastSavedContent = '';
        updateSaveStatus('unsaved');
    }

    // ========================================
    // FUNÇÕES DO EDITOR
    // ========================================
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
                    if (typeof arg === 'object' && arg !== null) {
                        try {
                            return JSON.stringify(arg, null, 2);
                        } catch (e) {
                            return String(arg);
                        }
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
            
            if (currentCodeId) {
                registerCodeRun(currentCodeId);
            }
            
            const result = (function() {
                try {
                    return eval(code);
                } catch (error) {
                    throw error;
                }
            })();
            
            if (result !== undefined) {
                let resultStr;
                if (typeof result === 'object' && result !== null) {
                    try {
                        resultStr = JSON.stringify(result, null, 2);
                    } catch (e) {
                        resultStr = String(result);
                    }
                } else {
                    resultStr = String(result);
                }
                appendToOutput('=> ' + resultStr, 'result');
            }
        } catch (error) {
            appendToOutput('Error: ' + error.message, 'error');
            console.error('Code execution error:', error);
        } finally {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        }
    }

    async function registerCodeRun(codeId) {
        try {
            await fetch(`${API_BASE}/codes/${codeId}/run`, {
                method: 'POST',
                headers: authToken ? {
                    'Authorization': `Bearer ${authToken}`
                } : {}
            });
        } catch (error) {
            console.error('Erro ao registrar execução:', error);
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

    // ========================================
    // FUNÇÕES DE HISTÓRICO
    // ========================================
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

    // ========================================
    // FUNÇÕES DE UTILIDADE
    // ========================================
    function copyCode() {
        if (!codeEditor) return;
        codeEditor.select();
        codeEditor.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            showNotification('Código copiado para a área de transferência!');
        } catch (err) {
            console.error('Falha ao copiar código:', err);
            showNotification('Falha ao copiar código', 'error');
        }
    }

    function toggleFullscreen() {
        const editorContainer = document.querySelector('.editor-container');
        if (!document.fullscreenElement) {
            if (editorContainer && editorContainer.requestFullscreen) {
                editorContainer.requestFullscreen().catch(err => {
                    console.error(`Erro ao ativar tela cheia: ${err.message}`);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    function selectAll() {
        if (!codeEditor) return;
        codeEditor.select();
        codeEditor.setSelectionRange(0, codeEditor.value.length);
    }

    function markEditorDirty() {
        if (!codeEditor) return;
        if (lastSavedContent !== codeEditor.value) {
            isEditorDirty = true;
            updateSaveStatus('unsaved');
        } else {
            isEditorDirty = false;
            updateSaveStatus('saved');
        }
        clearTimeout(window.historySaveTimeout);
        window.historySaveTimeout = setTimeout(saveToHistory, 500);
    }

    function updateSaveStatus(status) {
        if (!saveStatus) return;
        switch (status) {
            case 'saved':
                saveStatus.textContent = 'Salvo';
                saveStatus.style.color = '#888';
                break;
            case 'unsaved':
                saveStatus.textContent = 'Não salvo';
                saveStatus.style.color = '#e74c3c';
                break;
            case 'saving':
                saveStatus.textContent = 'Salvando...';
                saveStatus.style.color = '#f39c12';
                break;
        }
    }

    // ========================================
    // FUNÇÕES DE SALVAMENTO
    // ========================================
    async function saveCode() {
        if (!currentUser) {
            showLoginModal();
            return;
        }
        if (!codeEditor || !codeTitle) return;
        
        const title = codeTitle.value || 'Untitled.js';
        const content = codeEditor.value;
        updateSaveStatus('saving');
        
        try {
            if (currentCodeId) {
                // Atualizar código existente
                const response = await fetch(`${API_BASE}/codes/${currentCodeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        description: 'Código criado no JS Editor'
                    })
                });
                const data = await response.json();
                if (data.success) {
                    lastSavedContent = content;
                    isEditorDirty = false;
                    updateSaveStatus('saved');
                    showNotification('Código atualizado com sucesso!');
                } else {
                    updateSaveStatus('unsaved');
                    showNotification('Erro ao atualizar código: ' + data.message, 'error');
                }
            } else {
                // Criar novo código
                const response = await fetch(`${API_BASE}/codes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        description: 'Código criado no JS Editor',
                        isPublic: false
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentCodeId = data.data.code._id;
                    lastSavedContent = content;
                    isEditorDirty = false;
                    updateSaveStatus('saved');
                    showNotification('Código salvo com sucesso!');
                } else {
                    updateSaveStatus('unsaved');
                    showNotification('Erro ao salvar código: ' + data.message, 'error');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar código:', error);
            updateSaveStatus('unsaved');
            showNotification('Erro ao salvar código. Tente novamente.', 'error');
        }
    }

    // ========================================
    // FUNÇÕES DE COMPARTILHAMENTO
    // ========================================
    async function showShareModal() {
        console.log('🔗 Iniciando compartilhamento...');
        
        if (!currentUser) {
            console.log('❌ Usuário não autenticado');
            showLoginModal();
            return;
        }
        
        if (!currentCodeId) {
            console.log('❌ Nenhum código para compartilhar');
            showNotification('Salve o código primeiro para compartilhar', 'error');
            return;
        }
        
        console.log('📤 Gerando link para código ID:', currentCodeId);
        
        try {
            const response = await fetch(`${API_BASE}/codes/${currentCodeId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    allowEditing: false,
                    expiresIn: 30
                })
            });
            
            console.log('📡 Resposta do servidor:', response.status);
            const data = await response.json();
            console.log('📄 Dados recebidos:', data);
            
            if (data.success) {
                // Encontrar elementos do modal
                const shareModal = document.getElementById('share-modal');
                const shareLink = document.getElementById('share-link');
                const shareSuccess = document.getElementById('share-success');
                
                console.log('🔍 Elementos encontrados:', {
                    shareModal: !!shareModal,
                    shareLink: !!shareLink,
                    shareSuccess: !!shareSuccess
                });
                
                if (shareModal && shareLink) {
                    shareLink.value = data.data.shareUrl;
                    
                    if (shareSuccess) {
                        shareSuccess.textContent = 'Link de compartilhamento gerado com sucesso!';
                        shareSuccess.style.color = '#27ae60';
                        shareSuccess.style.display = 'block';
                    }
                    
                    shareModal.style.display = 'block';
                    
                    // Focar no campo do link para facilitar a seleção
                    setTimeout(() => {
                        shareLink.select();
                    }, 100);
                    
                    console.log('✅ Modal de compartilhamento aberto');
                    showNotification('Link de compartilhamento gerado!');
                } else {
                    console.error('❌ Elementos do modal não encontrados');
                    // Fallback: copiar diretamente para área de transferência
                    try {
                        await navigator.clipboard.writeText(data.data.shareUrl);
                        showNotification('Link copiado para área de transferência!');
                    } catch (clipboardError) {
                        console.error('Erro ao copiar:', clipboardError);
                        // Mostrar o link em um prompt como último recurso
                        prompt('Link de compartilhamento (Ctrl+C para copiar):', data.data.shareUrl);
                    }
                }
            } else {
                console.error('❌ Erro na resposta:', data.message);
                showNotification('Erro ao gerar link: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('💥 Erro na requisição:', error);
            showNotification('Erro ao compartilhar código', 'error');
        }
    }

    async function shareCodeFromList(codeId) {
        console.log('🔗 Compartilhando código da lista:', codeId);
        
        try {
            const response = await fetch(`${API_BASE}/codes/${codeId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    allowEditing: false,
                    expiresIn: 30
                })
            });

            const data = await response.json();
            console.log('📡 Resposta do compartilhamento:', data);

            if (data.success) {
                const shareModal = document.getElementById('share-modal');
                const shareLink = document.getElementById('share-link');
                const shareSuccess = document.getElementById('share-success');
                
                if (shareModal && shareLink) {
                    shareLink.value = data.data.shareUrl;
                    
                    if (shareSuccess) {
                        shareSuccess.textContent = 'Link de compartilhamento gerado com sucesso!';
                        shareSuccess.style.color = '#27ae60';
                        shareSuccess.style.display = 'block';
                    }
                    
                    shareModal.style.display = 'block';
                    
                    setTimeout(() => {
                        shareLink.select();
                    }, 100);
                    
                    showNotification('Link de compartilhamento gerado!');
                } else {
                    // Fallback
                    try {
                        await navigator.clipboard.writeText(data.data.shareUrl);
                        showNotification('Link copiado para área de transferência!');
                    } catch (clipboardError) {
                        prompt('Link de compartilhamento (Ctrl+C para copiar):', data.data.shareUrl);
                    }
                }
            } else {
                showNotification('Erro ao gerar link: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao compartilhar código:', error);
            showNotification('Erro ao compartilhar código', 'error');
        }
    }	

    // ========================================
    // FUNÇÕES DO PERFIL E GERENCIAMENTO
    // ========================================
    async function showProfileModal() {
        if (!currentUser) {
            showLoginModal();
            return;
        }
        
        const profileModal = document.getElementById('profile-codes-modal');
        if (profileModal) {
            profileModal.style.display = 'block';
            await loadUserCodes();
        }
    }

    async function loadUserCodes(page = 1, search = '') {
        const loadingDiv = document.getElementById('codes-loading');
        const codesListDiv = document.getElementById('codes-list');
        const paginationDiv = document.getElementById('codes-pagination');
        
        if (loadingDiv) loadingDiv.classList.remove('hidden');
        if (codesListDiv) codesListDiv.innerHTML = '';
        if (paginationDiv) paginationDiv.classList.add('hidden');
        
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10'
            });
            
            if (search) {
                params.append('search', search);
            }
            
            const response = await fetch(`${API_BASE}/codes?${params}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayUserCodes(data.data.codes);
                setupPagination(data.data.pagination);
                currentPage = page;
                searchQuery = search;
            } else {
                showError('Erro ao carregar códigos: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao carregar códigos:', error);
            showError('Erro ao carregar códigos');
        } finally {
            if (loadingDiv) loadingDiv.classList.add('hidden');
        }
    }

    function displayUserCodes(codes) {
        const codesListDiv = document.getElementById('codes-list');
        if (!codesListDiv) return;
        
        if (codes.length === 0) {
            codesListDiv.innerHTML = `
                <div class="empty-state">
                    <h3>Nenhum código encontrado</h3>
                    <p>Comece criando seu primeiro código!</p>
                    <button onclick="createNewCode()" class="btn btn-primary">+ Criar Código</button>
                </div>
            `;
            return;
        }
        
        const codesHTML = codes.map(code => {
            const lastModified = new Date(code.updatedAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="code-item" data-code-id="${code._id}">
                    <div class="code-item-header">
                        <div>
                            <h3 class="code-item-title">${escapeHtml(code.title)}</h3>
                            <p class="code-item-description">${escapeHtml(code.description || 'Sem descrição')}</p>
                        </div>
                        <div class="code-item-actions">
                            <button onclick="loadCodeInEditor('${code._id}')" class="btn btn-small btn-primary">Abrir</button>
                            <button onclick="shareCodeFromList('${code._id}')" class="btn btn-small">Compartilhar</button>
                            <button onclick="confirmDeleteCode('${code._id}', '${escapeHtml(code.title)}')" class="btn btn-small">Excluir</button>
                        </div>
                    </div>
                    <div class="code-item-meta">
                        <div class="code-item-stats">
                            <span>👁️ ${code.stats.views}</span>
                            <span>▶️ ${code.stats.runs}</span>
                            <span class="code-status ${code.isPublic ? 'public' : 'private'}">
                                ${code.isPublic ? 'Público' : 'Privado'}
                            </span>
                        </div>
                        <span>Modificado em ${lastModified}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        codesListDiv.innerHTML = codesHTML;
    }

    function setupPagination(pagination) {
        const paginationDiv = document.getElementById('codes-pagination');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        
        if (!paginationDiv || !prevBtn || !nextBtn || !pageInfo) return;
        
        if (pagination.total > 1) {
            paginationDiv.classList.remove('hidden');
            
            prevBtn.disabled = pagination.current <= 1;
            nextBtn.disabled = pagination.current >= pagination.total;
            
            pageInfo.textContent = `Página ${pagination.current} de ${pagination.total}`;
            
            prevBtn.onclick = () => {
                if (pagination.current > 1) {
                    loadUserCodes(pagination.current - 1, searchQuery);
                }
            };
            
            nextBtn.onclick = () => {
                if (pagination.current < pagination.total) {
                    loadUserCodes(pagination.current + 1, searchQuery);
                }
            };
        } else {
            paginationDiv.classList.add('hidden');
        }
    }

    async function loadCodeInEditor(codeId) {
        try {
            const response = await fetch(`${API_BASE}/codes/${codeId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const code = data.data.code;
                
                if (codeEditor) codeEditor.value = code.content;
                if (codeTitle) codeTitle.value = code.title;
                
                currentCodeId = code._id;
                lastSavedContent = code.content;
                isEditorDirty = false;
                
                updateHighlighting();
                updateLineNumbers();
                updateSaveStatus('saved');
                
                const profileModal = document.getElementById('profile-codes-modal');
                if (profileModal) profileModal.style.display = 'none';
                
                showNotification(`Código "${code.title}" carregado com sucesso!`);
            } else {
                showNotification('Erro ao carregar código: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar código:', error);
            showNotification('Erro ao carregar código', 'error');
        }
    }

    async function shareCodeFromList(codeId) {
        try {
            const response = await fetch(`${API_BASE}/codes/${codeId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    allowEditing: false,
                    expiresIn: 30
                })
            });

            const data = await response.json();

            if (data.success) {
                const shareModal = document.getElementById('share-modal');
                const shareLink = document.getElementById('share-link');
                const shareSuccess = document.getElementById('share-success');
                
                if (shareModal && shareLink && shareSuccess) {
                    shareLink.value = data.data.shareUrl;
                    shareSuccess.textContent = 'Link de compartilhamento gerado com sucesso!';
                    shareModal.style.display = 'block';
                }
            } else {
                showNotification('Erro ao gerar link: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao compartilhar código:', error);
            showNotification('Erro ao compartilhar código', 'error');
        }
    }

    function confirmDeleteCode(codeId, codeTitle) {
        showConfirmModal(
            'Excluir Código',
            `Tem certeza que deseja excluir o código "${codeTitle}"?`,
            () => deleteCode(codeId)
        );
    }

    async function deleteCode(codeId) {
        try {
            const response = await fetch(`${API_BASE}/codes/${codeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Código excluído com sucesso!');
                
                if (currentCodeId === codeId) {
                    currentCodeId = null;
                    lastSavedContent = '';
                    updateSaveStatus('unsaved');
                }
                
                await loadUserCodes(currentPage, searchQuery);
            } else {
                showNotification('Erro ao excluir código: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir código:', error);
            showNotification('Erro ao excluir código', 'error');
        }
    }

    function createNewCode() {
        if (codeEditor) codeEditor.value = '';
        if (codeTitle) codeTitle.value = 'novo-codigo.js';
        
        currentCodeId = null;
        lastSavedContent = '';
        isEditorDirty = false;
        
        updateHighlighting();
        updateLineNumbers();
        updateSaveStatus('unsaved');
        
        const profileModal = document.getElementById('profile-codes-modal');
        if (profileModal) profileModal.style.display = 'none';
        
        if (codeEditor) codeEditor.focus();
        
        showNotification('Novo código criado!');
    }

    // ========================================
    // FUNÇÕES DE MODAL E NOTIFICAÇÃO
    // ========================================
    function showConfirmModal(title, message, onConfirm) {
        const confirmModal = document.getElementById('confirm-modal');
        const confirmTitle = document.getElementById('confirm-title');
        const confirmMessage = document.getElementById('confirm-message');
        const confirmYes = document.getElementById('confirm-yes');
        const confirmNo = document.getElementById('confirm-no');
        
        if (confirmModal && confirmTitle && confirmMessage && confirmYes && confirmNo) {
            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            
            const newConfirmYes = confirmYes.cloneNode(true);
            const newConfirmNo = confirmNo.cloneNode(true);
            confirmYes.parentNode.replaceChild(newConfirmYes, confirmYes);
            confirmNo.parentNode.replaceChild(newConfirmNo, confirmNo);
            
            newConfirmYes.addEventListener('click', () => {
                confirmModal.style.display = 'none';
                onConfirm();
            });
            
            newConfirmNo.addEventListener('click', () => {
                confirmModal.style.display = 'none';
            });
            
            confirmModal.style.display = 'block';
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        notification.style.backgroundColor = type === 'error' ? 'var(--error-color)' : 'rgba(0, 0, 0, 0.8)';
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

    function showLoginModal() {
        showNotification('Faça login para salvar e compartilhar códigos', 'error');
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'block';
        }
    }

    // ========================================
    // FUNÇÕES DE REDIMENSIONAMENTO
    // ========================================
    let isResizing = false;
    let lastX, lastY;
    
    if (resizer) {
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            lastX = e.clientX;
            lastY = e.clientY;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
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
            const workspaceRect = editorWorkspace.getBoundingClientRect();
            const codeRect = codeContainer.getBoundingClientRect();
            const newCodeWidth = codeRect.width + deltaX;
            const minWidth = 200;
            const maxWidth = workspaceRect.width - minWidth - 10;
            
            if (newCodeWidth >= minWidth && newCodeWidth <= maxWidth) {
                const newCodePercentage = (newCodeWidth / workspaceRect.width) * 100;
                const newOutputPercentage = 100 - newCodePercentage - 1;
                codeContainer.style.flex = `0 0 ${newCodePercentage}%`;
                outputContainer.style.width = `${newOutputPercentage}%`;
                lastX = e.clientX;
            }
        } else {
            const deltaY = e.clientY - lastY;
            const workspaceRect = editorWorkspace.getBoundingClientRect();
            const codeRect = codeContainer.getBoundingClientRect();
            const newCodeHeight = codeRect.height + deltaY;
            const minHeight = 150;
            const maxHeight = workspaceRect.height - minHeight - 10;
            
            if (newCodeHeight >= minHeight && newCodeHeight <= maxHeight) {
                const newOutputHeight = workspaceRect.height - newCodeHeight - 10;
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

    // ========================================
    // CONFIGURAÇÃO DE MODAIS
    // ========================================
    function setupModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.onclick = function() {
                    modal.style.display = 'none';
                };
            }
            window.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        setupAuthModals();
    }

    function setupAuthModals() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                const errorDiv = document.getElementById('login-error');
                
                try {
                    const response = await fetch(`${API_BASE}/auth/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            identifier: username,
                            password: password
                        })
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        authToken = data.data.token;
                        localStorage.setItem('auth_token', authToken);
                        currentUser = data.data.user;
                        showLoggedInState();
                        document.getElementById('login-modal').style.display = 'none';
                        showNotification('Login realizado com sucesso!');
                        loginForm.reset();
                        if (errorDiv) errorDiv.textContent = '';
                    } else {
                        if (errorDiv) errorDiv.textContent = data.message || 'Erro no login';
                    }
                } catch (error) {
                    console.error('Erro no login:', error);
                    if (errorDiv) errorDiv.textContent = 'Erro de conexão. Tente novamente.';
                }
            });
        }
        
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const confirmPassword = document.getElementById('register-confirm-password').value;
                const errorDiv = document.getElementById('register-error');
                
                if (password !== confirmPassword) {
                    if (errorDiv) errorDiv.textContent = 'As senhas não coincidem';
                    return;
                }
                
                try {
                    const response = await fetch(`${API_BASE}/auth/register`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username,
                            email,
                            password
                        })
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        authToken = data.data.token;
                        localStorage.setItem('auth_token', authToken);
                        currentUser = data.data.user;
                        showLoggedInState();
                        document.getElementById('register-modal').style.display = 'none';
                        showNotification('Conta criada com sucesso!');
                        registerForm.reset();
                        if (errorDiv) errorDiv.textContent = '';
                    } else {
                        if (errorDiv) {
                            errorDiv.textContent = data.message || 'Erro no registro';
                        }
                    }
                } catch (error) {
                    console.error('Erro no registro:', error);
                    if (errorDiv) errorDiv.textContent = 'Erro de conexão. Tente novamente.';
                }
            });
        }
    }

    function setupCodeSearch() {
        const searchInput = document.getElementById('search-codes');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput && searchBtn) {
            const performSearch = () => {
                const query = searchInput.value.trim();
                loadUserCodes(1, query);
            };
            
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }
    }

    function setupShareModal() {
        const copyLinkBtn = document.getElementById('copy-link-btn');
        const shareModal = document.getElementById('share-modal');
        const closeModalBtn = shareModal?.querySelector('.close-modal');
        const closeBtn = shareModal?.querySelector('.close');
        
        console.log('🔧 Configurando modal de compartilhamento...', {
            copyLinkBtn: !!copyLinkBtn,
            shareModal: !!shareModal,
            closeModalBtn: !!closeModalBtn,
            closeBtn: !!closeBtn
        });
        
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', async () => {
                const shareLink = document.getElementById('share-link');
                if (shareLink && shareLink.value) {
                    try {
                        // Tentar usar a API moderna de clipboard
                        if (navigator.clipboard && window.isSecureContext) {
                            await navigator.clipboard.writeText(shareLink.value);
                        } else {
                            // Fallback para método antigo
                            shareLink.select();
                            shareLink.setSelectionRange(0, 99999);
                            document.execCommand('copy');
                        }
                        
                        // Feedback visual
                        const originalText = copyLinkBtn.textContent;
                        copyLinkBtn.textContent = '✅ Copiado!';
                        copyLinkBtn.classList.add('copied');
                        
                        setTimeout(() => {
                            copyLinkBtn.textContent = originalText;
                            copyLinkBtn.classList.remove('copied');
                        }, 2000);
                        
                        showNotification('Link copiado para a área de transferência!');
                        console.log('✅ Link copiado com sucesso');
                    } catch (err) {
                        console.error('❌ Falha ao copiar link:', err);
                        showNotification('Falha ao copiar link. Tente selecionar e copiar manualmente.', 'error');
                        
                        // Como último recurso, selecionar o texto
                        shareLink.select();
                        shareLink.setSelectionRange(0, 99999);
                    }
                } else {
                    showNotification('Nenhum link para copiar', 'error');
                }
            });
        }
        
        // Fechar modal com botão de fechar
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                shareModal.style.display = 'none';
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                shareModal.style.display = 'none';
            });
        }
        
        // Fechar modal clicando fora
        if (shareModal) {
            window.addEventListener('click', (event) => {
                if (event.target === shareModal) {
                    shareModal.style.display = 'none';
                }
            });
        }
    }

    // ========================================
    // FUNÇÕES AUXILIARES
    // ========================================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    // Tornar funções globais para os botões onclick
    window.loadCodeInEditor = loadCodeInEditor;
    window.shareCodeFromList = shareCodeFromList;
    window.confirmDeleteCode = confirmDeleteCode;
    window.createNewCode = createNewCode;

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    function init() {
        checkAuth();
        
        // Configurar editor
        if (codeEditor && lineNumbers && highlightLayer) {
            highlightLayer.style.background = "transparent";
            updateLineNumbers();
            updateHighlighting();
            saveToHistory();
            
            // Event listeners do editor
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
                
                if (e.ctrlKey || e.metaKey) {
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
        
        // Event listeners dos botões principais
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
        
        // Event listeners de autenticação
        if (loginBtn) loginBtn.addEventListener('click', () => {
            document.getElementById('login-modal').style.display = 'block';
        });
        if (registerBtn) registerBtn.addEventListener('click', () => {
            document.getElementById('register-modal').style.display = 'block';
        });
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
        if (profileBtn) profileBtn.addEventListener('click', showProfileModal);
        
        // Event listener do título
        if (codeTitle) {
            codeTitle.addEventListener('change', function() {
                markEditorDirty();
            });
        }

        // Event listener do botão "Novo Código"
        const newCodeBtn = document.getElementById('new-code-btn');
        if (newCodeBtn) {
            newCodeBtn.addEventListener('click', createNewCode);
        }

        // Configurar funcionalidades
        setupModals();
        setupShareModal();
        setupCodeSearch();
        
        // Focar no editor
        if (codeEditor) {
            codeEditor.focus();
        }
    }

    // Inicializar aplicação
    init();
});