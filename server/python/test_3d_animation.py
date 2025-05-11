"""
Test script for 3D animation feature
====================================
This script demonstrates how to use the 3D animation API endpoint.
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path
import requests

def main():
    parser = argparse.ArgumentParser(description='Test 3D animation API')
    parser.add_argument('--video', type=str, required=True, help='Path to the input video file')
    parser.add_argument('--x', type=int, default=None, help='X coordinate of the dancer (optional)')
    parser.add_argument('--y', type=int, default=None, help='Y coordinate of the dancer (optional)')
    parser.add_argument('--host', type=str, default='http://localhost:8000', help='API host URL')
    args = parser.parse_args()
    
    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Error: Video file not found: {video_path}")
        return 1
    
    print(f"Testing 3D animation API with video: {video_path}")
    
    # Prepare the request
    url = f"{args.host}/create-3d-animation"
    params = {}
    if args.x is not None and args.y is not None:
        params['click_x'] = args.x
        params['click_y'] = args.y
    
    # Send the request
    with open(video_path, 'rb') as f:
        files = {'file': (video_path.name, f, 'video/mp4')}
        print(f"Sending request to {url}")
        response = requests.post(url, params=params, files=files)
    
    # Print the response
    if response.status_code == 200:
        data = response.json()
        print("API response:")
        print(f"  Success: {data.get('success', False)}")
        print(f"  Message: {data.get('message', '')}")
        
        if 'error' in data:
            print(f"  Error: {data['error']}")
        
        if 'output_files' in data:
            print("  Output files:")
            for file_type, file_path in data['output_files'].items():
                print(f"    {file_type}: {file_path}")
    else:
        print(f"Error: HTTP {response.status_code}")
        print(response.text)
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 