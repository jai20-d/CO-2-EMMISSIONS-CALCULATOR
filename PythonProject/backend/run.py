import subprocess
import sys
import os


def main():
    print("🚀 Starting CarbonTrack Pro Backend...")

    # Install dependencies if needed
    print("📦 Checking dependencies...")
    try:
        import fastapi
        import uvicorn
        print("✅ Dependencies already installed")
    except ImportError:
        print("📥 Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

    # Run the FastAPI server
    print("🌐 Starting server on http://127.0.0.1:8000")
    print("📚 API Docs: http://127.0.0.1:8000/docs")
    print("\n" + "=" * 50)

    os.chdir("api")
    subprocess.run([sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"])


if __name__ == "__main__":
    main()