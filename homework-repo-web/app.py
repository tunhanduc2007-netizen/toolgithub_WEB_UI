import os
import re
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, request, Response, render_template, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

# Default path to search for files
DEFAULT_WORKSPACE = str(Path.home())

def get_history_file():
    folder = Path.home() / ".homework-repo-tool"
    folder.mkdir(exist_ok=True)
    return folder / "history.json"

def get_github_username():
    try:
        return subprocess.check_output(
            ["gh", "api", "user", "--jq", ".login"],
            text=True,
        ).strip()
    except Exception:
        return None

def github_repo_exists(username, repo_name):
    try:
        result = subprocess.run(
            ["gh", "repo", "view", f"{username}/{repo_name}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False

def get_exercise_from_file_name(name):
    match = re.search(r"(\d+)", Path(name).stem)
    if not match:
        return None
    return int(match.group(1))

def slugify(value):
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    slug = slug.strip("-._").lower()
    return slug or "homework"

def format_number(prefix, number):
    try:
        return f"{prefix}{int(number):02d}"
    except (ValueError, TypeError):
        return f"{prefix}{number}"

def create_session_repo_name(file_name, session, course):
    stem = Path(file_name).stem
    ss = format_number("ss", session)
    return f"{slugify(stem)}-{ss}-{course.upper()}"

def create_repo_topics(session, course):
    return ["homework", slugify(course), format_number("ss", session)]

def get_command_output(command):
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return None
        output = result.stdout.strip() or result.stderr.strip()
        return output.splitlines()[0] if output else "OK"
    except Exception:
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/doctor', methods=['GET'])
def doctor_check():
    checks = {}
    
    # Python Check
    checks['python'] = {
        'ok': True,
        'version': f"Python {platform_version()}"
    }
    
    # Git Check
    git_path = shutil.which("git")
    git_version = get_command_output(["git", "--version"]) if git_path else None
    checks['git'] = {
        'ok': bool(git_path),
        'version': git_version or "Chưa cài đặt Git"
    }
    
    # GitHub CLI Check
    gh_path = shutil.which("gh")
    gh_version = get_command_output(["gh", "--version"]) if gh_path else None
    checks['gh'] = {
        'ok': bool(gh_path),
        'version': gh_version or "Chưa cài đặt GitHub CLI"
    }
    
    # GitHub Auth Check
    if gh_path:
        auth_result = subprocess.run(
            ["gh", "auth", "status"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        username = get_github_username()
        checks['gh_auth'] = {
            'ok': auth_result.returncode == 0,
            'detail': f"Đã đăng nhập: {username}" if auth_result.returncode == 0 else "Chưa đăng nhập. Vui lòng chạy 'gh auth login'"
        }
    else:
        checks['gh_auth'] = {
            'ok': False,
            'detail': "Hãy cài đặt GitHub CLI trước"
        }
        
    # pipx Check
    pipx_path = shutil.which("pipx")
    pipx_version = get_command_output(["pipx", "--version"]) if pipx_path else None
    checks['pipx'] = {
        'ok': bool(pipx_path),
        'version': pipx_version or "Chưa cài đặt pipx"
    }
    
    return jsonify(checks)

def platform_version():
    import sys
    return sys.version.split()[0]

@app.route('/api/history', methods=['GET'])
def get_history():
    history_file = get_history_file()
    if not history_file.exists():
        return jsonify([])
    
    try:
        history = json.loads(history_file.read_text(encoding="utf-8"))
        # Sort history by submitted_at desc
        history.sort(key=lambda x: x.get('submitted_at', ''), reverse=True)
        return jsonify(history)
    except Exception:
        return jsonify([])

@app.route('/api/scan', methods=['POST'])
def scan_directory():
    data = request.json or {}
    dir_path_str = data.get('path', DEFAULT_WORKSPACE)
    
    dir_path = Path(dir_path_str).expanduser().resolve()
    if not dir_path.exists() or not dir_path.is_dir():
        return jsonify({'error': 'Thư mục không tồn tại hoặc không hợp lệ'}), 400
        
    files = []
    ignored_names = {'venv', '__pycache__', 'node_modules', '.gitignore', 'README.md', 'history.json'}
    
    try:
        for item in dir_path.iterdir():
            if item.name.startswith('.'):
                continue
            if item.name in ignored_names:
                continue
            if item.name.startswith("submission-links-") and item.suffix == ".md":
                continue
            
            is_dir = item.is_dir()
            exercise = get_exercise_from_file_name(item.name)
            
            if is_dir:
                try:
                    # Calculate recursive directory size
                    size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
                except Exception:
                    size = 0
                type_str = 'folder'
            else:
                size = item.stat().st_size
                type_str = 'file'
                
            files.append({
                'name': item.name,
                'path': str(item),
                'exercise': exercise if exercise is not None else "",
                'size': size,
                'type': type_str
            })
        
        # Sort by exercise number, then by name
        files.sort(key=lambda x: (x['exercise'] if isinstance(x['exercise'], int) else 999999, x['name'].lower()))
        return jsonify({
            'current_path': str(dir_path),
            'files': files
        })
    except Exception as e:
        return jsonify({'error': f'Không thể đọc thư mục: {str(e)}'}), 500

@app.route('/api/browse', methods=['POST'])
def browse_directory():
    try:
        cmd = ["osascript", "-e", 'POSIX path of (choose folder with prompt "Chọn thư mục chứa bài tập:")']
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        path = result.stdout.strip()
        return jsonify({'path': path})
    except subprocess.CalledProcessError:
        # Người dùng hủy chọn
        return jsonify({'path': None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview', methods=['POST'])
def preview_repos():
    data = request.json or {}
    files = data.get('files', [])
    session = data.get('session', '')
    course = data.get('course', '')
    
    if not session or not course:
        return jsonify({'error': 'Session và Course là bắt buộc'}), 400
        
    previews = []
    for file_name in files:
        repo_name = create_session_repo_name(file_name, session, course)
        previews.append({
            'file': file_name,
            'repo_name': repo_name
        })
        
    return jsonify(previews)

@app.route('/api/submit', methods=['POST'])
def submit_homework():
    data = request.json or {}
    files = data.get('files', []) # list of dicts: {'name': '...', 'path': '...'}
    session = data.get('session', '')
    course = data.get('course', '')
    visibility = data.get('visibility', 'public')
    org = data.get('org', '').strip()
    
    if not files or not session or not course:
        return jsonify({'error': 'Thiếu tham số bắt buộc'}), 400

    def sse_generator():
        username = get_github_username()
        if not username:
            err_msg = {'type': 'error', 'message': 'Không tìm thấy tài khoản GitHub. Vui lòng chạy gh auth login.'}
            yield f"data: {json.dumps(err_msg)}\n\n"
            return
            
        submitted = []
        
        for file_info in files:
            file_name = file_info['name']
            file_path = Path(file_info['path'])
            exercise = get_exercise_from_file_name(file_name)
            
            repo_name_val = file_info.get('repo_name')
            if repo_name_val:
                if "/" in repo_name_val:
                    parts = repo_name_val.split("/")
                    repo_name = parts[-1]
                    file_org = parts[0]
                else:
                    repo_name = repo_name_val
                    file_org = org
            else:
                repo_name = create_session_repo_name(file_name, session, course)
                file_org = org
            
            status_msg = {'type': 'status', 'file': file_name, 'message': f'Bắt đầu xử lý {file_name}...'}
            yield f"data: {json.dumps(status_msg)}\n\n"
            
            if not file_path.exists():
                err_msg = {'type': 'file_error', 'file': file_name, 'message': f'Lỗi: File {file_name} không tồn tại.'}
                yield f"data: {json.dumps(err_msg)}\n\n"
                continue
                
            temp_path = Path(tempfile.mkdtemp())
            repo_folder = temp_path / repo_name
            repo_folder.mkdir()
            
            try:
                # Copy file or directory contents to temp folder
                if file_path.is_dir():
                    for sub_item in file_path.iterdir():
                        if sub_item.name.startswith('.') or sub_item.name in {'venv', '__pycache__', 'node_modules'}:
                            continue
                        if sub_item.is_dir():
                            shutil.copytree(sub_item, repo_folder / sub_item.name, ignore=shutil.ignore_patterns('*.pyc', '__pycache__', '.git', 'venv'))
                        else:
                            shutil.copy2(sub_item, repo_folder / sub_item.name)
                else:
                    shutil.copy2(file_path, repo_folder / file_name)
                
                # Auto-generate a beautiful README.md
                ex_label = f"EX{int(exercise):02d}" if exercise is not None else "-"
                ss_label = f"SS{int(session):02d}"
                readme_content = (
                    f"# Bài tập: {file_name}\n\n"
                    f"Được tải lên tự động bởi **Homework Repo Tool**.\n\n"
                    f"## 📝 Thông tin bài nộp\n"
                    f"- **Môn học (Course):** {course.upper()}\n"
                    f"- **Buổi học (Session):** {ss_label}\n"
                    f"- **Bài tập (Exercise):** {ex_label}\n"
                    f"- **Thời gian nộp:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                    f"---\n"
                    f"*Chúc bạn học tập tốt!*\n"
                )
                (repo_folder / "README.md").write_text(readme_content, encoding="utf-8")
                
                # Git Init
                cmd_msg = {'type': 'cmd', 'file': file_name, 'message': '> git init'}
                yield f"data: {json.dumps(cmd_msg)}\n\n"
                subprocess.run(["git", "init"], cwd=repo_folder, check=True, stdout=subprocess.DEVNULL)
                
                # Git Add
                cmd_msg = {'type': 'cmd', 'file': file_name, 'message': '> git add .'}
                yield f"data: {json.dumps(cmd_msg)}\n\n"
                subprocess.run(["git", "add", "."], cwd=repo_folder, check=True)
                
                # Git Commit
                cmd_msg = {'type': 'cmd', 'file': file_name, 'message': f'> git commit -m "Submit {repo_name}"'}
                yield f"data: {json.dumps(cmd_msg)}\n\n"
                subprocess.run(["git", "commit", "-m", f"Submit {repo_name}"], cwd=repo_folder, check=True, stdout=subprocess.DEVNULL)
                
                # GitHub Repo Check / Create
                target_owner = file_org if file_org else username
                exists = github_repo_exists(target_owner, repo_name)
                if exists:
                    warn_msg = {'type': 'warning', 'file': file_name, 'message': f'Repository {target_owner}/{repo_name} đã tồn tại. Sẽ tiến hành cập nhật...'}
                    yield f"data: {json.dumps(warn_msg)}\n\n"
                else:
                    visibility_flag = "--public" if visibility == "public" else "--private"
                    full_repo_path = f"{file_org}/{repo_name}" if file_org else repo_name
                    cmd_msg = {'type': 'cmd', 'file': file_name, 'message': f'> gh repo create {full_repo_path} {visibility_flag}'}
                    yield f"data: {json.dumps(cmd_msg)}\n\n"
                    subprocess.run(["gh", "repo", "create", full_repo_path, visibility_flag], cwd=repo_folder, check=True, stdout=subprocess.DEVNULL)
                
                # Git Branch Rename
                subprocess.run(["git", "branch", "-M", "main"], cwd=repo_folder, check=True)
                
                # Git Remote Set
                repo_url = f"https://github.com/{file_org}/{repo_name}" if file_org else f"https://github.com/{username}/{repo_name}"
                git_url = f"{repo_url}.git"
                
                # Remote URL check & update
                remote_check = subprocess.run(["git", "remote", "get-url", "origin"], cwd=repo_folder, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if remote_check.returncode == 0:
                    subprocess.run(["git", "remote", "set-url", "origin", git_url], cwd=repo_folder, check=True)
                else:
                    subprocess.run(["git", "remote", "add", "origin", git_url], cwd=repo_folder, check=True)
                
                # Git Push
                cmd_msg = {'type': 'cmd', 'file': file_name, 'message': '> git push -u origin main --force'}
                yield f"data: {json.dumps(cmd_msg)}\n\n"
                subprocess.run(["git", "push", "-u", "origin", "main", "--force"], cwd=repo_folder, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Add GitHub Repo Topics
                topics = create_repo_topics(session, course)
                target_repo_path = f"{file_org}/{repo_name}" if file_org else f"{username}/{repo_name}"
                topic_cmd = ["gh", "repo", "edit", target_repo_path]
                for topic in topics:
                    topic_cmd.extend(["--add-topic", topic])
                
                topics_str = ", ".join(topics)
                cmd_msg = {'type': 'cmd', 'file': file_name, 'message': f'> gh repo edit --add-topic {topics_str}'}
                yield f"data: {json.dumps(cmd_msg)}\n\n"
                subprocess.run(topic_cmd, check=False, stdout=subprocess.DEVNULL)
                
                # Write to local history
                history_file = get_history_file()
                if history_file.exists():
                    try:
                        history = json.loads(history_file.read_text(encoding="utf-8"))
                    except Exception:
                        history = []
                else:
                    history = []
                
                exercise_label = f"EX{int(exercise):02d}" if exercise is not None else "-"
                session_label = f"SS{int(session):02d}" if session is not None else "-"
                history_repo_name = f"{file_org}/{repo_name}" if file_org else repo_name
                
                item = {
                    "exercise": exercise_label,
                    "session": session_label,
                    "course": course.upper(),
                    "repo_name": history_repo_name,
                    "repo_url": repo_url,
                    "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                history.append(item)
                history_file.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")
                
                submitted.append({
                    'file': file_name,
                    'repo_name': history_repo_name,
                    'repo_url': repo_url
                })
                
                success_msg = {'type': 'success', 'file': file_name, 'repo_url': repo_url, 'message': f'Thành công: Đã nộp {file_name} -> {repo_url}'}
                yield f"data: {json.dumps(success_msg)}\n\n"
                
            except subprocess.CalledProcessError as e:
                err_msg = {'type': 'file_error', 'file': file_name, 'message': f'Lỗi Git/GitHub CLI: {str(e)}'}
                yield f"data: {json.dumps(err_msg)}\n\n"
            except Exception as e:
                err_msg = {'type': 'file_error', 'file': file_name, 'message': f'Lỗi hệ thống: {str(e)}'}
                yield f"data: {json.dumps(err_msg)}\n\n"
            finally:
                shutil.rmtree(temp_path, ignore_errors=True)
                
        # Generate markdown markdown links in original scanned directory if possible
        if submitted and files:
            try:
                first_file_path = Path(files[0]['path'])
                parent_dir = first_file_path.parent
                session_label = f"SS{int(session):02d}"
                output_path = parent_dir / f"submission-links-ss{int(session):02d}.md"
                
                lines = [
                    f"# Submission Links - {session_label} - {course.upper()}",
                    "",
                    "| Exercise | File | Repository | Link |",
                    "| -------- | ---- | ---------- | ---- |",
                ]
                for s in submitted:
                    ex = get_exercise_from_file_name(s['file'])
                    ex_label = f"EX{int(ex):02d}" if ex is not None else "-"
                    lines.append(f"| {ex_label} | {s['file']} | {s['repo_name']} | {s['repo_url']} |")
                
                output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                
                info_msg = {'type': 'info', 'message': f'Đã tạo tệp liên kết nộp bài tại {output_path.name}'}
                yield f"data: {json.dumps(info_msg)}\n\n"
            except Exception as e:
                info_msg = {'type': 'info', 'message': f'Không thể tự động tạo file tổng hợp liên kết: {str(e)}'}
                yield f"data: {json.dumps(info_msg)}\n\n"
                
        done_msg = {'type': 'done', 'message': 'Hoàn thành quá trình nộp bài!'}
        yield f"data: {json.dumps(done_msg)}\n\n"
        
    return Response(sse_generator(), mimetype='text/event-stream')

@app.route('/api/history', methods=['DELETE'])
def delete_history_item():
    data = request.json or {}
    repo_name = data.get('repo_name')
    delete_github = data.get('delete_github', False)
    
    if not repo_name:
        return jsonify({'error': 'Thiếu tên repository'}), 400
        
    history_file = get_history_file()
    if not history_file.exists():
        return jsonify({'error': 'Không tìm thấy file lịch sử'}), 404
        
    try:
        history = json.loads(history_file.read_text(encoding="utf-8"))
    except Exception:
        return jsonify({'error': 'Lỗi đọc file lịch sử'}), 500
        
    # Find and remove item
    new_history = [item for item in history if item.get('repo_name') != repo_name]
    
    github_error = None
    if delete_github:
        # Delete repo on GitHub
        username = get_github_username()
        if username:
            try:
                subprocess.run(
                    ["gh", "repo", "delete", f"{username}/{repo_name}", "--yes"],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    text=True
                )
            except subprocess.CalledProcessError as e:
                github_error = f"Không thể xoá repo trên GitHub: {e.stderr.strip()}"
            except Exception as e:
                github_error = f"Lỗi kết nối GitHub: {str(e)}"
        else:
            github_error = "Chưa đăng nhập GitHub."
            
    # Save history
    try:
        history_file.write_text(json.dumps(new_history, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        return jsonify({'error': f'Lỗi lưu file lịch sử: {str(e)}'}), 500
        
    return jsonify({
        'success': True,
        'github_error': github_error
    })

def run_gh_json_command(command):
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False
        )
        if result.returncode != 0:
            return None, result.stderr.strip() or f"Lệnh thất bại với mã lỗi {result.returncode}"
        return json.loads(result.stdout), None
    except Exception as e:
        return None, str(e)

@app.route('/api/github/accounts', methods=['GET'])
def get_github_accounts():
    # Fetch user profile
    user_data, err = run_gh_json_command(["gh", "api", "user"])
    if err or not user_data:
        return jsonify({'error': f'Không thể lấy thông tin tài khoản GitHub: {err or "Chưa đăng nhập"}'}), 401
    
    # Fetch orgs
    orgs_data, err = run_gh_json_command(["gh", "api", "user/orgs"])
    if err:
        orgs_data = []
        
    return jsonify({
        'user': {
            'login': user_data.get('login'),
            'name': user_data.get('name') or user_data.get('login'),
            'avatar_url': user_data.get('avatar_url'),
            'html_url': user_data.get('html_url'),
            'public_repos': user_data.get('public_repos', 0)
        },
        'orgs': [{
            'login': org.get('login'),
            'avatar_url': org.get('avatar_url'),
            'description': org.get('description') or ''
        } for org in orgs_data]
    })

@app.route('/api/github/repos', methods=['GET'])
def get_github_repos():
    account = request.args.get('account')
    if not account:
        return jsonify({'error': 'Thiếu tham số account'}), 400
        
    # Fetch repositories
    repos, err = run_gh_json_command([
        "gh", "repo", "list", account,
        "--limit", "100",
        "--json", "name,isPrivate,url,description,updatedAt"
    ])
    
    if err:
        return jsonify({'error': f'Không thể tải danh sách repository: {err}'}), 500
        
    # Sort repos by updatedAt desc
    repos.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)
    
    return jsonify(repos)

@app.route('/api/github/repos', methods=['DELETE'])
def delete_github_repo():
    data = request.json or {}
    repo_path = data.get('repo_path')
    if not repo_path:
        return jsonify({'error': 'Thiếu đường dẫn repository (owner/name)'}), 400
        
    try:
        result = subprocess.run(
            ["gh", "repo", "delete", repo_path, "--yes"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False
        )
        if result.returncode != 0:
            return jsonify({'error': result.stderr.strip() or f"Không thể xoá repository {repo_path}"}), 500
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/open-folder', methods=['POST'])
def open_folder():
    data = request.json or {}
    dir_path_str = data.get('path')
    if not dir_path_str:
        return jsonify({'error': 'Thiếu đường dẫn thư mục'}), 400
        
    dir_path = Path(dir_path_str).expanduser().resolve()
    if not dir_path.exists() or not dir_path.is_dir():
        return jsonify({'error': 'Thư mục không tồn tại'}), 400
        
    try:
        # On Mac, run the 'open' command
        subprocess.run(["open", str(dir_path)], check=True)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': f'Không thể mở thư mục: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5005)

