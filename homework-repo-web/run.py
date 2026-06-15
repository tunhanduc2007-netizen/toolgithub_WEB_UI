import os
import sys
import webbrowser
from threading import Timer

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5005/")

if __name__ == "__main__":
    print("🚀 Đang khởi động Homework Repo Tool Web UI...")
    print("🔗 Địa chỉ Web: http://127.0.0.1:5005/")
    
    # Open the browser in a separate thread after 1.5s
    Timer(1.5, open_browser).start()
    
    # Run the main Flask application
    try:
        os.system(f"{sys.executable} app.py")
    except KeyboardInterrupt:
        print("\n👋 Đã đóng server Web UI.")
