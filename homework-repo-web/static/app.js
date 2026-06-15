document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let detectedFiles = [];
    let checkedFiles = [];
    let repoToDelete = null;
    let historyList = [];
    let githubAccounts = [];
    let githubSelectedAccount = null;
    let githubRepos = [];
    
    // DOM Elements
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const workspacePathInput = document.getElementById('workspace-path');
    const btnScan = document.getElementById('btn-scan');
    const btnBrowse = document.getElementById('btn-browse');
    const btnOpenFolder = document.getElementById('btn-open-folder');
    const btnSubmit = document.getElementById('btn-submit');
    const paramCourse = document.getElementById('param-course');
    const paramSession = document.getElementById('param-session');
    const paramOrg = document.getElementById('param-org');
    const filesListTbody = document.getElementById('files-list-tbody');
    const headerSelectAll = document.getElementById('header-select-all');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    const btnRefreshFiles = document.getElementById('btn-refresh-files');
    
    const historyTbody = document.getElementById('history-tbody');
    const btnRefreshHistory = document.getElementById('btn-refresh-history');
    const historySearchInput = document.getElementById('history-search');
    
    const doctorResults = document.getElementById('doctor-results');
    const githubUsernameHeader = document.getElementById('github-username-header');
    const statusTextFooter = document.getElementById('status-text-footer');
    const statusDotFooter = document.querySelector('.sidebar-footer .status-dot');
    
    // GitHub Explorer Elements
    const githubAccountsList = document.getElementById('github-accounts-list');
    const githubAccountStats = document.getElementById('github-account-stats');
    const githubRepoSearch = document.getElementById('github-repo-search');
    const btnRefreshGitHubRepos = document.getElementById('btn-refresh-github-repos');
    const btnRefreshGitHubAccounts = document.getElementById('btn-refresh-github-accounts');
    const githubReposTbody = document.getElementById('github-repos-tbody');
    
    // Modal Elements
    const submitModal = document.getElementById('submit-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const submitProgressBar = document.getElementById('submit-progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const progressText = document.getElementById('progress-text');
    const terminalOutput = document.getElementById('terminal-output');

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-modal');
    const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    const checkboxDeleteGithub = document.getElementById('checkbox-delete-github');

    // 1. Tab Navigation Routing
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.getAttribute('data-tab');
            
            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
            
            if (tabName === 'history') {
                loadHistory();
            } else if (tabName === 'doctor') {
                runDoctorCheck();
            } else if (tabName === 'github') {
                loadGitHubExplorer();
            }
        });
    });

    // Initialize Default Path (Set to home directory or last saved path)
    const savedPath = localStorage.getItem('last_workspace_path');
    workspacePathInput.value = savedPath || "~/Desktop";

    // Load Course ID, Session ID, and Organization preferences
    const savedCourse = localStorage.getItem('pref_course');
    if (savedCourse) paramCourse.value = savedCourse;

    const savedSession = localStorage.getItem('pref_session');
    if (savedSession) paramSession.value = savedSession;

    const savedOrg = localStorage.getItem('pref_org');
    if (savedOrg) paramOrg.value = savedOrg;

    // Initialize Doctor status check on load
    runDoctorCheck(true);

    // Auto scan if saved path exists
    if (savedPath) {
        scanWorkspace();
    }

    // 2. Directory Selection & Scanning
    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            btnBrowse.disabled = true;
            const originalText = btnBrowse.innerHTML;
            btnBrowse.innerHTML = `<span class="spinner"></span> Đang chọn...`;
            try {
                const response = await fetch('/api/browse', { method: 'POST' });
                const result = await response.json();
                if (response.ok && result.path) {
                    workspacePathInput.value = result.path;
                    scanWorkspace();
                }
            } catch (error) {
                console.error(error);
                alert('Không thể mở hộp thoại chọn thư mục.');
            } finally {
                btnBrowse.disabled = false;
                btnBrowse.innerHTML = originalText;
            }
        });
    }

    if (btnOpenFolder) {
        btnOpenFolder.addEventListener('click', async () => {
            const path = workspacePathInput.value.trim();
            if (!path) {
                alert('Vui lòng chọn thư mục trước!');
                return;
            }
            btnOpenFolder.disabled = true;
            const originalText = btnOpenFolder.innerHTML;
            btnOpenFolder.innerHTML = `<span class="spinner"></span>...`;
            try {
                const response = await fetch('/api/open-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                const result = await response.json();
                if (!response.ok) {
                    alert(result.error || 'Có lỗi xảy ra khi mở thư mục.');
                }
            } catch (error) {
                console.error(error);
                alert('Không thể kết nối đến máy chủ.');
            } finally {
                btnOpenFolder.disabled = false;
                btnOpenFolder.innerHTML = originalText;
            }
        });
    }

    btnScan.addEventListener('click', scanWorkspace);
    if (btnRefreshFiles) {
        btnRefreshFiles.addEventListener('click', scanWorkspace);
    }
    
    async function scanWorkspace() {
        const path = workspacePathInput.value.trim();
        if (!path) {
            alert('Vui lòng nhập đường dẫn thư mục!');
            return;
        }
        
        btnScan.disabled = true;
        btnScan.innerHTML = `<span class="spinner"></span> Đang quét...`;
        
        try {
            // Load history list first to check for submitted status
            try {
                const histResponse = await fetch('/api/history');
                historyList = await histResponse.json();
            } catch (e) {
                console.error("Lỗi tải lịch sử:", e);
            }

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                detectedFiles = result.files;
                workspacePathInput.value = result.current_path; // Update with absolute path resolved
                localStorage.setItem('last_workspace_path', result.current_path);
                
                // Automatically detect Session and Course from path
                autoDetectSessionAndCourse(result.current_path);
                
                renderFilesList();
            } else {
                alert(result.error || 'Có lỗi xảy ra khi quét thư mục.');
                filesListTbody.innerHTML = `<tr><td colspan="5" align="center" class="empty-state" style="color: var(--status-red)">❌ Lỗi: ${result.error}</td></tr>`;
                btnSubmit.disabled = true;
            }
        } catch (error) {
            console.error(error);
            alert('Không thể kết nối đến máy chủ.');
        } finally {
            btnScan.disabled = false;
            btnScan.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Quét Thư Mục`;
        }
    }

    // Helper: Parse Course ID & Session ID from workspace directory path
    function autoDetectSessionAndCourse(pathStr) {
        if (!pathStr) return;
        
        const normalizedPath = pathStr.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        
        let detectedSession = null;
        let detectedCourse = null;
        
        // Scan path segments from right to left
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            const partUpper = part.toUpperCase();
            
            // 1. Detect Session (e.g. ss21, ss_21, session05)
            if (detectedSession === null) {
                const sessionMatch = part.match(/ss[_-]?(\d+)/i) || part.match(/session[_-]?(\d+)/i);
                if (sessionMatch) {
                    detectedSession = parseInt(sessionMatch[1]);
                }
            }
            
            // 2. Detect Course (e.g. IT205, PY101, CSDL12, CNTT6)
            if (detectedCourse === null) {
                const courseMatch = partUpper.match(/(IT[_-]?\d+)/) || 
                                    partUpper.match(/(PY[_-]?\d+)/) || 
                                    partUpper.match(/(CSDL[_-]?\d+)/) || 
                                    partUpper.match(/(CNTT[_-]?\d+)/) ||
                                    partUpper.match(/(DB[_-]?\d+)/);
                if (courseMatch) {
                    detectedCourse = courseMatch[1].replace(/[_-]/g, '').toLowerCase();
                }
            }
        }
        
        if (detectedSession !== null) {
            paramSession.value = detectedSession;
            localStorage.setItem('pref_session', detectedSession);
        }
        if (detectedCourse !== null) {
            paramCourse.value = detectedCourse;
            localStorage.setItem('pref_course', detectedCourse);
        }
    }

    // Helper: Check if file has already been submitted in the current Course & Session
    function checkIsSubmitted(file) {
        const course = paramCourse.value.trim().toUpperCase();
        const sessionVal = paramSession.value.trim();
        const session = sessionVal !== "" ? `SS${String(parseInt(sessionVal)).padStart(2, '0')}` : '';
        const exercise = file.exercise !== "" ? `EX${String(file.exercise).padStart(2, '0')}` : '';
        
        if (!course || !session || !exercise) return false;
        
        return historyList.some(item => 
            item.course.toUpperCase() === course &&
            item.session === session &&
            item.exercise === exercise
        );
    }

    // 3. Render Files List
    function renderFilesList() {
        if (detectedFiles.length === 0) {
            filesListTbody.innerHTML = `<tr><td colspan="5" align="center" class="empty-state">Không tìm thấy bài tập nào trong thư mục này.</td></tr>`;
            btnSubmit.disabled = true;
            return;
        }
        
        filesListTbody.innerHTML = '';
        
        // Filter out already submitted files/folders for this session & course
        const unsubmittedFiles = detectedFiles.filter(file => !checkIsSubmitted(file));
        
        if (unsubmittedFiles.length === 0) {
            filesListTbody.innerHTML = `<tr><td colspan="5" align="center" class="empty-state" style="color: var(--status-green); font-weight: 500; padding: 40px !important;">✅ Tất cả bài tập trong thư mục này đã được nộp thành công!</td></tr>`;
            btnSubmit.disabled = true;
            headerSelectAll.checked = false;
            return;
        }
        
        unsubmittedFiles.forEach((file) => {
            const tr = document.createElement('tr');
            
            const formattedSize = formatBytes(file.size);
            const initialRepoName = predictRepoName(file.name);
            const originalIndex = detectedFiles.indexOf(file);
            
            tr.innerHTML = `
                <td><input type="checkbox" class="file-select-checkbox" data-index="${originalIndex}" checked></td>
                <td>
                    <span class="file-row-name">${file.type === 'folder' ? '📁' : '📄'} ${file.name}</span>
                </td>
                <td>${file.exercise !== "" ? `EX${String(file.exercise).padStart(2, '0')}` : '-'}</td>
                <td>
                    <input type="text" class="repo-name-input" id="repo-input-${originalIndex}" data-original="${initialRepoName}" value="${initialRepoName}" style="width: 100%; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); color: var(--accent-cyan); font-family: var(--font-mono); font-size: 0.85rem; padding: 6px 12px; border-radius: 6px; transition: var(--transition-smooth);">
                </td>
                <td align="right" style="font-family: var(--font-mono); font-size: 0.8rem;">${formattedSize}</td>
            `;
            
            filesListTbody.appendChild(tr);
        });
        
        // Setup individual checkbox change events
        document.querySelectorAll('.file-select-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.target.dataset.manuallyChanged = 'true';
                updateSubmitButtonState();
            });
        });
        
        headerSelectAll.checked = true;
        updateSubmitButtonState();
    }

    // Helper: Predict Repo Name client side
    function predictRepoName(fileName) {
        const course = paramCourse.value.trim().toUpperCase() || 'COURSE';
        const sessionVal = paramSession.value.trim();
        const session = sessionVal !== "" ? String(parseInt(sessionVal)).padStart(2, '0') : 'SS';
        const orgVal = paramOrg ? paramOrg.value.trim() : '';
        
        // slugify
        let slug = fileName.replace(/\.[^/.]+$/, ""); // strip extension
        slug = slug.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-._|-._$/g, "").toLowerCase();
        slug = slug || "homework";
        
        const baseRepoName = `${slug}-ss${session}-${course}`;
        return orgVal ? `${orgVal}/${baseRepoName}` : baseRepoName;
    }

    // Update predicted repo names live when params change and save preferences
    [paramCourse, paramSession, paramOrg].forEach(input => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (e.target.id === 'param-course') {
                localStorage.setItem('pref_course', val);
            } else if (e.target.id === 'param-session') {
                localStorage.setItem('pref_session', val);
            } else if (e.target.id === 'param-org') {
                localStorage.setItem('pref_org', val);
            }
            renderFilesList();
        });
    });

    // Checkbox bulk operations
    headerSelectAll.addEventListener('change', (e) => {
        document.querySelectorAll('.file-select-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
        updateSubmitButtonState();
    });

    btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.file-select-checkbox').forEach(cb => cb.checked = true);
        headerSelectAll.checked = true;
        updateSubmitButtonState();
    });

    btnDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.file-select-checkbox').forEach(cb => cb.checked = false);
        headerSelectAll.checked = false;
        updateSubmitButtonState();
    });

    function updateSubmitButtonState() {
        const selectedCount = document.querySelectorAll('.file-select-checkbox:checked').length;
        btnSubmit.disabled = selectedCount === 0;
        btnSubmit.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Bắt đầu nộp ${selectedCount} bài tập`;
    }

    // 4. Submit Operations (Streaming response)
    btnSubmit.addEventListener('click', startSubmission);
    
    async function startSubmission() {
        const selectedCheckboxes = document.querySelectorAll('.file-select-checkbox:checked');
        const filesToSubmit = Array.from(selectedCheckboxes).map(cb => {
            const index = parseInt(cb.getAttribute('data-index'));
            const file = detectedFiles[index];
            const repoInputEl = document.getElementById(`repo-input-${index}`);
            return {
                ...file,
                repo_name: repoInputEl ? repoInputEl.value.trim() : ''
            };
        });
        
        const course = paramCourse.value.trim();
        const session = paramSession.value.trim();
        const org = paramOrg ? paramOrg.value.trim() : '';
        const visibility = document.querySelector('input[name="param-visibility"]:checked').value;
        
        if (!course || !session) {
            alert('Vui lòng điền đầy đủ Mã môn học và Mã buổi!');
            return;
        }

        // Open modal & Reset progress
        submitModal.classList.add('active');
        btnCloseModal.disabled = true;
        submitProgressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Đang khởi tạo kết nối...';
        terminalOutput.innerHTML = `<div class="log-line system">[HỆ THỐNG] Bắt đầu quá trình tải lên ${filesToSubmit.length} bài tập...</div>`;
        
        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: filesToSubmit,
                    session,
                    course,
                    visibility,
                    org
                })
            });

            if (!response.ok) {
                const errResult = await response.json();
                appendTerminalLine('error', `Lỗi máy chủ: ${errResult.error}`);
                progressText.textContent = 'Quá trình thất bại.';
                btnCloseModal.disabled = false;
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            
            let successCount = 0;
            let failureCount = 0;
            const totalFiles = filesToSubmit.length;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last partial line in the buffer
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            handleSubmissionLogEvent(data, totalFiles, (s, f) => {
                                successCount = s;
                                failureCount = f;
                            }, successCount, failureCount);
                        } catch (e) {
                            console.error('Lỗi parse log line:', e);
                        }
                    }
                }
            }
            
            // Parse remaining buffer
            if (buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.substring(6));
                    handleSubmissionLogEvent(data, totalFiles, (s, f) => {
                        successCount = s;
                        failureCount = f;
                    }, successCount, failureCount);
                } catch (e) {}
            }
            
        } catch (error) {
            console.error(error);
            appendTerminalLine('error', `Lỗi kết nối hoặc sự cố mạng: ${error.message}`);
            progressText.textContent = 'Quá trình bị gián đoạn.';
        } finally {
            btnCloseModal.disabled = false;
        }
    }

    function handleSubmissionLogEvent(data, totalFiles, updateCounts, successCount, failureCount) {
        if (data.type === 'status') {
            appendTerminalLine('status', `📦 [${data.file}] ${data.message}`);
            progressText.textContent = `Đang xử lý bài tập: ${data.file}...`;
        } else if (data.type === 'cmd') {
            appendTerminalLine('cmd', data.message);
        } else if (data.type === 'warning') {
            appendTerminalLine('warning', `⚠️ ${data.message}`);
        } else if (data.type === 'success') {
            successCount++;
            updateCounts(successCount, failureCount);
            appendTerminalLine('success', `✅ ${data.message}`);
            updateProgressBar(successCount, failureCount, totalFiles);
        } else if (data.type === 'file_error') {
            failureCount++;
            updateCounts(successCount, failureCount);
            appendTerminalLine('error', `❌ ${data.message}`);
            updateProgressBar(successCount, failureCount, totalFiles);
        } else if (data.type === 'info') {
            appendTerminalLine('info', `ℹ️ ${data.message}`);
        } else if (data.type === 'error') {
            appendTerminalLine('error', `💥 LỖI HỆ THỐNG: ${data.message}`);
            progressText.textContent = 'Lỗi nghiêm trọng xảy ra.';
        } else if (data.type === 'done') {
            appendTerminalLine('system', `\n[HỆ THỐNG] ${data.message}`);
            appendTerminalLine('info', `Đã hoàn thành: ${successCount} thành công, ${failureCount} thất bại.`);
            progressText.textContent = 'Hoàn thành nộp bài!';
            submitProgressBar.style.width = '100%';
            progressPercent.textContent = '100%';
        }
    }

    function updateProgressBar(success, failure, total) {
        const completed = success + failure;
        const percent = Math.min(100, Math.round((completed / total) * 100));
        submitProgressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
    }

    function appendTerminalLine(type, text) {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        
        // Escape HTML
        line.textContent = text;
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    btnCloseModal.addEventListener('click', () => {
        submitModal.classList.remove('active');
        // Refresh scanned workspace
        scanWorkspace();
    });

    // 5. History Loading & Rendering
    async function loadHistory() {
        historyTbody.innerHTML = `<tr><td colspan="7" align="center" class="empty-state"><span class="spinner"></span> Đang tải lịch sử...</td></tr>`;
        if (historySearchInput) {
            historySearchInput.value = '';
        }
        
        try {
            const response = await fetch('/api/history');
            historyList = await response.json();
            renderHistory(historyList);
        } catch (error) {
            console.error(error);
            historyTbody.innerHTML = `<tr><td colspan="7" align="center" class="empty-state" style="color: var(--status-red)">Không thể tải lịch sử nộp bài.</td></tr>`;
        }
    }

    function renderHistory(items) {
        if (!items || items.length === 0) {
            historyTbody.innerHTML = `<tr><td colspan="7" align="center" class="empty-state">Không tìm thấy lịch sử nộp bài nào khớp.</td></tr>`;
            return;
        }
        
        historyTbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: white;">${item.course}</td>
                <td><span class="repo-preview-tag" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-purple); border-color: rgba(139, 92, 246, 0.2);">${item.session}</span></td>
                <td><span class="repo-preview-tag" style="background: rgba(6, 182, 212, 0.1); color: var(--accent-cyan); border-color: rgba(6, 182, 212, 0.2);">${item.exercise}</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.85rem;">${item.repo_name}</td>
                <td>
                    <a href="${item.repo_url}" target="_blank" class="repo-link">
                        GitHub Repo
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">${item.submitted_at}</td>
                <td align="center">
                    <button class="btn-delete-history" data-repo="${item.repo_name}" style="background: transparent; border: none; color: var(--status-red); cursor: pointer; display: inline-flex; align-items: center; padding: 4px; transition: opacity 0.2s;" title="Xoá khỏi lịch sử">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            historyTbody.appendChild(tr);
        });

        // Attach click events to delete buttons
        document.querySelectorAll('.btn-delete-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.btn-delete-history');
                repoToDelete = button.getAttribute('data-repo');
                checkboxDeleteGithub.checked = false;
                deleteModal.classList.add('active');
            });
        });
    }

    if (historySearchInput) {
        historySearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderHistory(historyList);
                return;
            }
            const filtered = historyList.filter(item => {
                return (item.course && item.course.toLowerCase().includes(query)) ||
                       (item.session && item.session.toLowerCase().includes(query)) ||
                       (item.exercise && item.exercise.toLowerCase().includes(query)) ||
                       (item.repo_name && item.repo_name.toLowerCase().includes(query));
            });
            renderHistory(filtered);
        });
    }

    btnRefreshHistory.addEventListener('click', loadHistory);

    // 6. Doctor System Diagnosis
    async function runDoctorCheck(silent = false) {
        if (!silent) {
            doctorResults.innerHTML = `<div style="grid-column: 1/-1;" align="center" class="empty-state"><span class="spinner"></span> Đang chẩn đoán hệ thống...</div>`;
        }
        
        try {
            const response = await fetch('/api/doctor');
            const data = await response.json();
            
            // Check system ready (critical: python, git, gh, gh_auth)
            const isSystemReady = data.python.ok && data.git.ok && data.gh.ok && data.gh_auth.ok;
            
            if (isSystemReady) {
                statusTextFooter.textContent = 'Hệ thống sẵn sàng';
                statusDotFooter.className = 'status-dot green';
            } else {
                statusTextFooter.textContent = 'Cấu hình chưa đủ';
                statusDotFooter.className = 'status-dot yellow';
            }
            
            // Update Header user badge
            if (data.gh_auth.ok) {
                githubUsernameHeader.textContent = data.gh_auth.detail.replace('Đã đăng nhập: ', '');
            } else {
                githubUsernameHeader.textContent = 'Chưa đăng nhập GitHub';
            }
            
            if (silent) return;
            
            // Generate items on tab
            doctorResults.innerHTML = '';
            
            const doctorItems = [
                { key: 'python', label: 'Python Environment', data: data.python },
                { key: 'git', label: 'Git Client', data: data.git },
                { key: 'gh', label: 'GitHub CLI', data: data.gh },
                { key: 'gh_auth', label: 'GitHub Login Status', data: data.gh_auth, isAuth: true },
                { key: 'pipx', label: 'pipx Package Manager', data: data.pipx }
            ];
            
            doctorItems.forEach(item => {
                const card = document.createElement('div');
                card.className = `doctor-item`;
                
                const isOk = item.data.ok;
                const statusClass = isOk ? 'success' : 'danger';
                
                const icon = isOk 
                    ? `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                    : `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                
                card.innerHTML = `
                    <div class="doctor-icon-wrapper ${statusClass}">
                        ${icon}
                    </div>
                    <div class="doctor-info">
                        <h4>${item.label}</h4>
                        <p>${item.isAuth ? item.data.detail : item.data.version}</p>
                    </div>
                `;
                
                doctorResults.appendChild(card);
            });
            
        } catch (error) {
            console.error(error);
            if (!silent) {
                doctorResults.innerHTML = `<div style="grid-column: 1/-1;" align="center" class="empty-state" style="color: var(--status-red)">Không thể kết nối đến máy chủ chẩn đoán.</div>`;
            }
        }
    }

    // Helper: Format bytes to human readable
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // 7. Delete Modal Handlers
    const hideDeleteModal = () => {
        deleteModal.classList.remove('active');
        repoToDelete = null;
    };
    
    btnCloseDeleteModal.addEventListener('click', hideDeleteModal);
    btnCancelDelete.addEventListener('click', hideDeleteModal);
    
    btnConfirmDelete.addEventListener('click', async () => {
        if (!repoToDelete) return;
        
        const deleteGithub = checkboxDeleteGithub.checked;
        
        btnConfirmDelete.disabled = true;
        btnCancelDelete.disabled = true;
        btnCloseDeleteModal.disabled = true;
        btnConfirmDelete.textContent = deleteGithub ? 'Đang xoá repo...' : 'Đang xoá...';
        
        try {
            const response = await fetch('/api/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo_name: repoToDelete,
                    delete_github: deleteGithub
                })
            });
            
            const result = await response.json();
            if (response.ok) {
                if (result.github_error) {
                    alert(`Lưu ý: Đã xoá lịch sử cục bộ nhưng gặp lỗi khi xoá trên GitHub: \n${result.github_error}`);
                }
                hideDeleteModal();
                loadHistory();
            } else {
                alert(result.error || 'Có lỗi xảy ra khi xoá.');
            }
        } catch (error) {
            console.error(error);
            alert('Không thể kết nối đến máy chủ.');
        } finally {
            btnConfirmDelete.disabled = false;
            btnCancelDelete.disabled = false;
            btnCloseDeleteModal.disabled = false;
            btnConfirmDelete.textContent = 'Xoá';
        }
    });

    // ==========================================
    // GITHUB EXPLORER SECTION
    // ==========================================
    async function loadGitHubExplorer() {
        githubAccountsList.innerHTML = `<div class="empty-state" style="padding: 20px !important;"><span class="spinner"></span> Đang tải tài khoản...</div>`;
        githubReposTbody.innerHTML = `<tr><td colspan="5" align="center" class="empty-state">Chọn một tài khoản bên trái để tải danh sách kho chứa.</td></tr>`;
        githubAccountStats.innerHTML = '';
        
        try {
            const response = await fetch('/api/github/accounts');
            const data = await response.json();
            
            if (!response.ok) {
                githubAccountsList.innerHTML = `<div class="empty-state" style="padding: 20px !important; color: var(--status-red)">❌ ${data.error || 'Lỗi khi tải tài khoản'}</div>`;
                return;
            }
            
            // Build the accounts list: Personal User first, then Orgs
            githubAccounts = [];
            if (data.user) {
                githubAccounts.push({
                    login: data.user.login,
                    name: data.user.name,
                    avatar_url: data.user.avatar_url,
                    html_url: data.user.html_url,
                    public_repos: data.user.public_repos,
                    type: 'personal'
                });
            }
            
            if (data.orgs && data.orgs.length > 0) {
                data.orgs.forEach(org => {
                    githubAccounts.push({
                        login: org.login,
                        name: org.login,
                        avatar_url: org.avatar_url,
                        html_url: `https://github.com/${org.login}`,
                        description: org.description,
                        type: 'org'
                    });
                });
            }
            
            renderGitHubAccounts();
            
            // Auto-select first account if available
            if (githubAccounts.length > 0) {
                selectGitHubAccount(githubAccounts[0].login);
            }
            
        } catch (error) {
            console.error(error);
            githubAccountsList.innerHTML = `<div class="empty-state" style="padding: 20px !important; color: var(--status-red)">❌ Lỗi kết nối máy chủ.</div>`;
        }
    }
    
    function renderGitHubAccounts() {
        githubAccountsList.innerHTML = '';
        githubAccounts.forEach(account => {
            const btn = document.createElement('button');
            btn.className = `github-account-item ${githubSelectedAccount === account.login ? 'active' : ''}`;
            btn.setAttribute('data-login', account.login);
            
            const badgeClass = account.type === 'personal' ? 'personal' : 'org';
            const badgeLabel = account.type === 'personal' ? 'Cá nhân' : 'Tổ chức';
            
            btn.innerHTML = `
                <img src="${account.avatar_url}" class="github-account-avatar" alt="${account.login}">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: white; font-size: 0.9rem;">${account.name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">@${account.login}</span>
                </div>
                <span class="github-account-type-badge ${badgeClass}">${badgeLabel}</span>
            `;
            
            btn.addEventListener('click', () => {
                selectGitHubAccount(account.login);
            });
            
            githubAccountsList.appendChild(btn);
        });
    }
    
    function selectGitHubAccount(login) {
        githubSelectedAccount = login;
        
        // Update active class in list
        document.querySelectorAll('.github-account-item').forEach(btn => {
            if (btn.getAttribute('data-login') === login) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Find selected account data
        const account = githubAccounts.find(a => a.login === login);
        if (account) {
            // Render Stats
            const typeLabel = account.type === 'personal' ? 'Tài khoản cá nhân' : 'Tổ chức';
            githubAccountStats.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div><strong>Loại:</strong> ${typeLabel}</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong>Liên kết:</strong> <a href="${account.html_url}" target="_blank" class="repo-link" style="font-size: 0.85rem;">github.com/${account.login}</a>
                    </div>
                    ${account.description ? `<div style="font-style: italic; margin-top: 6px; color: var(--text-muted); font-size: 0.8rem; line-height: 1.4;">"${account.description}"</div>` : ''}
                </div>
            `;
            
            // Load repos
            loadGitHubRepos(login);
        }
    }
    
    async function loadGitHubRepos(accountLogin) {
        githubReposTbody.innerHTML = `<tr><td colspan="6" align="center" class="empty-state"><span class="spinner"></span> Đang tải danh sách kho chứa...</td></tr>`;
        if (githubRepoSearch) {
            githubRepoSearch.value = '';
        }
        
        try {
            const response = await fetch(`/api/github/repos?account=${encodeURIComponent(accountLogin)}`);
            const data = await response.json();
            
            if (!response.ok) {
                githubReposTbody.innerHTML = `<tr><td colspan="6" align="center" class="empty-state" style="color: var(--status-red)">❌ Lỗi: ${data.error || 'Không thể tải repos'}</td></tr>`;
                return;
            }
            
            githubRepos = data;
            renderGitHubRepos(githubRepos);
        } catch (error) {
            console.error(error);
            githubReposTbody.innerHTML = `<tr><td colspan="6" align="center" class="empty-state" style="color: var(--status-red)">❌ Lỗi kết nối mạng.</td></tr>`;
        }
    }
    
    function renderGitHubRepos(repos) {
        if (!repos || repos.length === 0) {
            githubReposTbody.innerHTML = `<tr><td colspan="6" align="center" class="empty-state">Không có kho chứa nào.</td></tr>`;
            return;
        }
        
        githubReposTbody.innerHTML = '';
        repos.forEach(repo => {
            const tr = document.createElement('tr');
            
            const visibilityLabel = repo.isPrivate ? 'Private' : 'Public';
            const visibilityClass = repo.isPrivate ? 'private' : 'public';
            
            // Format updated time nicely
            let updatedTimeStr = repo.updatedAt;
            try {
                const date = new Date(repo.updatedAt);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                updatedTimeStr = `${day}/${month}/${year} ${hours}:${minutes}`;
            } catch (e) {}
            
            tr.innerHTML = `
                <td><strong style="color: white; font-family: var(--font-mono); font-size: 0.9rem;">${repo.name}</strong></td>
                <td><span class="visibility-badge ${visibilityClass}">${visibilityLabel}</span></td>
                <td><div class="repo-desc-text" title="${repo.description || 'Không có mô tả'}">${repo.description || '<span style="color: var(--text-muted); font-style: italic;">Không có mô tả</span>'}</div></td>
                <td align="right" style="font-size: 0.8rem; color: var(--text-secondary);">${updatedTimeStr}</td>
                <td align="center">
                    <a href="${repo.url}" target="_blank" class="repo-link" title="Mở trên GitHub">
                        GitHub
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </td>
                <td align="center">
                    <button class="btn-delete-github-repo" data-repo-path="${githubSelectedAccount}/${repo.name}" data-repo-name="${repo.name}" style="background: transparent; border: none; color: var(--status-red); cursor: pointer; display: inline-flex; align-items: center; padding: 4px; transition: opacity 0.2s;" title="Xoá repository này trên GitHub">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            githubReposTbody.appendChild(tr);
        });

        // Attach click events to delete buttons
        document.querySelectorAll('.btn-delete-github-repo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.btn-delete-github-repo');
                repoPathToGithubDelete = button.getAttribute('data-repo-path');
                repoNameToGithubDelete = button.getAttribute('data-repo-name');
                
                githubDeleteRepoName.textContent = repoNameToGithubDelete;
                githubDeleteModal.classList.add('active');
            });
        });
    }
    
    // Attach Search logic
    if (githubRepoSearch) {
        githubRepoSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderGitHubRepos(githubRepos);
                return;
            }
            const filtered = githubRepos.filter(repo => {
                return (repo.name && repo.name.toLowerCase().includes(query)) ||
                       (repo.description && repo.description.toLowerCase().includes(query));
            });
            renderGitHubRepos(filtered);
        });
    }
    
    // Attach Refresh listener
    if (btnRefreshGitHubRepos) {
        btnRefreshGitHubRepos.addEventListener('click', () => {
            if (githubSelectedAccount) {
                loadGitHubRepos(githubSelectedAccount);
            }
        });
    }

    if (btnRefreshGitHubAccounts) {
        btnRefreshGitHubAccounts.addEventListener('click', loadGitHubExplorer);
    }

    // GitHub Delete Modal Elements
    const githubDeleteModal = document.getElementById('github-delete-modal');
    const btnCloseGithubDeleteModal = document.getElementById('btn-close-github-delete-modal');
    const btnCancelGithubDelete = document.getElementById('btn-cancel-github-delete');
    const btnConfirmGithubDelete = document.getElementById('btn-confirm-github-delete');
    const githubDeleteRepoName = document.getElementById('github-delete-repo-name');
    
    let repoPathToGithubDelete = null;
    let repoNameToGithubDelete = null;

    // GitHub Delete Modal Handlers
    const hideGithubDeleteModal = () => {
        githubDeleteModal.classList.remove('active');
        repoPathToGithubDelete = null;
        repoNameToGithubDelete = null;
    };
    
    if (btnCloseGithubDeleteModal) btnCloseGithubDeleteModal.addEventListener('click', hideGithubDeleteModal);
    if (btnCancelGithubDelete) btnCancelGithubDelete.addEventListener('click', hideGithubDeleteModal);
    
    if (btnConfirmGithubDelete) {
        btnConfirmGithubDelete.addEventListener('click', async () => {
            if (!repoPathToGithubDelete) return;
            
            btnConfirmGithubDelete.disabled = true;
            btnCancelGithubDelete.disabled = true;
            if (btnCloseGithubDeleteModal) btnCloseGithubDeleteModal.disabled = true;
            btnConfirmGithubDelete.innerHTML = `<span class="spinner"></span> Đang xoá...`;
            
            try {
                const response = await fetch('/api/github/repos', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ repo_path: repoPathToGithubDelete })
                });
                
                const result = await response.json();
                if (response.ok) {
                    hideGithubDeleteModal();
                    if (githubSelectedAccount) {
                        loadGitHubRepos(githubSelectedAccount);
                    }
                } else {
                    alert(result.error || 'Có lỗi xảy ra khi xoá repository.');
                }
            } catch (error) {
                console.error(error);
                alert('Không thể kết nối đến máy chủ.');
            } finally {
                btnConfirmGithubDelete.disabled = false;
                btnCancelGithubDelete.disabled = false;
                if (btnCloseGithubDeleteModal) btnCloseGithubDeleteModal.disabled = false;
                btnConfirmGithubDelete.textContent = 'Xoá Vĩnh Viễn';
            }
        });
    }
});
