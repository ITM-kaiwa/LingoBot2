import os
import sys
from api.index import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"Starting LingoBot local server at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
