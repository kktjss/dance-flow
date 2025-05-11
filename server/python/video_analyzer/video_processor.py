"""
Video Processor - Cropping and DeepMotion API Integration
==========================================================
* Crops videos to keep the dancer in the center
* Uses DeepMotion API to create 3D animations
"""

import os
import cv2
import json
import time
import logging
import requests
import numpy as np
import base64
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
import tempfile
import urllib.parse
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("video_processor")

# Try to import config settings
try:
    from config.settings import (
        DEEPMOTION_CLIENT_ID,
        DEEPMOTION_CLIENT_SECRET,
        DEEPMOTION_API_HOST,
        TEMP_DIR,
        OUTPUT_DIR,
    )
except ImportError:
    # Fallback to environment variables
    DEEPMOTION_CLIENT_ID = os.getenv("DEEPMOTION_CLIENT_ID", "")
    DEEPMOTION_CLIENT_SECRET = os.getenv("DEEPMOTION_CLIENT_SECRET", "")
    DEEPMOTION_API_HOST = os.getenv("DEEPMOTION_API_HOST", "https://animate3d.deepmotion.com")
    TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/dance_flow"))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/dance_flow/output"))

# Create directories if they don't exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class DeepMotionAPI:
    """Interface to DeepMotion's Animate 3D REST API"""
    
    def __init__(self, client_id: str, client_secret: str, api_host: str):
        """Initialize the DeepMotion API client
        
        Args:
            client_id: DeepMotion client ID
            client_secret: DeepMotion client secret
            api_host: DeepMotion API host URL
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_host = api_host
        self.session_cookie = None
    
    async def authenticate(self) -> bool:
        """Authenticate with the DeepMotion API and obtain a session cookie
        
        Returns:
            bool: True if authentication was successful, False otherwise
        """
        if not self.client_id or not self.client_secret:
            logger.error("DeepMotion client ID and secret are required")
            return False
        
        # Encode the client ID and secret
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Make the authentication request
        headers = {
            "Authorization": f"Basic {encoded_credentials}"
        }
        
        try:
            url = f"{self.api_host}/session/auth"
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                # Get the session cookie from the response
                cookies = response.cookies
                if 'dmsess' in cookies:
                    self.session_cookie = cookies['dmsess']
                    logger.info("Successfully authenticated with DeepMotion API")
                    return True
                else:
                    logger.error("No session cookie found in authentication response")
            else:
                logger.error(f"Authentication failed with status code {response.status_code}: {response.text}")
            
            return False
        
        except Exception as e:
            logger.error(f"Error during authentication: {str(e)}")
            return False
    
    async def get_upload_url(self, filename: str) -> Optional[str]:
        """Get a signed URL for uploading a file to DeepMotion
        
        Args:
            filename: The name of the file to upload
        
        Returns:
            str: The signed upload URL if successful, None otherwise
        """
        if not self.session_cookie:
            logger.error("Not authenticated. Call authenticate() first.")
            return None
        
        try:
            url = f"{self.api_host}/upload?n={urllib.parse.quote(filename)}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data:
                    logger.info(f"Got upload URL for {filename}")
                    return data['url']
                else:
                    logger.error(f"No upload URL found in response: {data}")
            else:
                logger.error(f"Failed to get upload URL: {response.status_code} - {response.text}")
            
            return None
        
        except Exception as e:
            logger.error(f"Error getting upload URL: {str(e)}")
            return None
    
    async def upload_file(self, file_path: Path, upload_url: str) -> bool:
        """Upload a file to the provided URL
        
        Args:
            file_path: The path to the file to upload
            upload_url: The URL to upload the file to
        
        Returns:
            bool: True if the upload was successful, False otherwise
        """
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Upload the file with a PUT request
            response = requests.put(
                upload_url,
                data=file_data,
                headers={'Content-Type': 'application/octet-stream'}
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully uploaded file to {upload_url}")
                return True
            else:
                logger.error(f"Failed to upload file: {response.status_code} - {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            return False
    
    async def start_processing(self, upload_url: str, crop_params: Optional[Dict] = None) -> Optional[str]:
        """Start processing a video with DeepMotion
        
        Args:
            upload_url: The URL of the uploaded file
            crop_params: Optional parameters for cropping the video
        
        Returns:
            str: The request ID if successful, None otherwise
        """
        if not self.session_cookie:
            logger.error("Not authenticated. Call authenticate() first.")
            return None
        
        try:
            url = f"{self.api_host}/process"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}",
                "Content-Type": "application/json"
            }
            
            # Create the parameters
            params = [
                "config=configDefault",
                "formats=bvh,fbx,mp4",  # Output formats
                "model=deepmotion_humanoid"  # Default model
            ]
            
            # Add crop parameters if provided
            if crop_params:
                left = crop_params.get('left', 0)
                top = crop_params.get('top', 0)
                right = crop_params.get('right', 1)
                bottom = crop_params.get('bottom', 1)
                crop_param = f"crop={left},{top},{right},{bottom}"
                params.append(crop_param)
            
            # Create the request body
            data = {
                "url": upload_url,
                "processor": "video2anim",
                "params": params
            }
            
            response = requests.post(url, headers=headers, json=data)
            
            if response.status_code == 200:
                data = response.json()
                if 'rid' in data:
                    logger.info(f"Successfully started processing with request ID: {data['rid']}")
                    return data['rid']
                else:
                    logger.error(f"No request ID found in response: {data}")
            else:
                logger.error(f"Failed to start processing: {response.status_code} - {response.text}")
            
            return None
        
        except Exception as e:
            logger.error(f"Error starting processing: {str(e)}")
            return None
    
    async def poll_status(self, request_id: str) -> Dict[str, Any]:
        """Poll the status of a processing job
        
        Args:
            request_id: The request ID to poll
        
        Returns:
            Dict: The status response
        """
        if not self.session_cookie:
            logger.error("Not authenticated. Call authenticate() first.")
            return {"status": "FAILURE", "details": "Not authenticated"}
        
        try:
            url = f"{self.api_host}/status/{request_id}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['count'] > 0:
                    status_info = data['status'][0]
                    logger.info(f"Job status for {request_id}: {status_info['status']}")
                    return status_info
                else:
                    logger.error(f"No status information found in response: {data}")
                    return {"status": "FAILURE", "details": "No status information"}
            else:
                logger.error(f"Failed to get status: {response.status_code} - {response.text}")
                return {"status": "FAILURE", "details": f"HTTP error: {response.status_code}"}
        
        except Exception as e:
            logger.error(f"Error polling status: {str(e)}")
            return {"status": "FAILURE", "details": str(e)}
    
    async def wait_for_completion(self, request_id: str, max_attempts: int = 60, delay: int = 5) -> Dict[str, Any]:
        """Wait for a job to complete by polling its status
        
        Args:
            request_id: The request ID to poll
            max_attempts: Maximum number of polling attempts
            delay: Delay in seconds between polling attempts
        
        Returns:
            Dict: The final status response
        """
        attempts = 0
        while attempts < max_attempts:
            status_info = await self.poll_status(request_id)
            
            if status_info['status'] == 'SUCCESS':
                return status_info
            elif status_info['status'] == 'FAILURE':
                return status_info
            
            # For in-progress jobs, log the progress
            if status_info['status'] == 'PROGRESS' and 'details' in status_info:
                details = status_info['details']
                if 'step' in details and 'total' in details:
                    progress = (details['step'] / details['total']) * 100
                    logger.info(f"Job {request_id} progress: {progress:.1f}% ({details['step']}/{details['total']})")
            
            # Wait before the next attempt
            await asyncio.sleep(delay)
            attempts += 1
        
        return {"status": "FAILURE", "details": "Timeout waiting for job completion"}
    
    async def get_download_urls(self, request_id: str) -> Dict[str, Any]:
        """Get download URLs for the processed files
        
        Args:
            request_id: The request ID
        
        Returns:
            Dict: The download URLs response
        """
        if not self.session_cookie:
            logger.error("Not authenticated. Call authenticate() first.")
            return {"status": "FAILURE", "details": "Not authenticated"}
        
        try:
            url = f"{self.api_host}/download/{request_id}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'links' in data and data['count'] > 0:
                    logger.info(f"Got download URLs for {request_id}")
                    return data['links'][0]
                else:
                    logger.error(f"No download links found in response: {data}")
                    return {"status": "FAILURE", "details": "No download links"}
            else:
                logger.error(f"Failed to get download URLs: {response.status_code} - {response.text}")
                return {"status": "FAILURE", "details": f"HTTP error: {response.status_code}"}
        
        except Exception as e:
            logger.error(f"Error getting download URLs: {str(e)}")
            return {"status": "FAILURE", "details": str(e)}
    
    async def download_file(self, url: str, output_path: Path) -> bool:
        """Download a file from a URL
        
        Args:
            url: The URL to download from
            output_path: The path to save the file to
        
        Returns:
            bool: True if the download was successful, False otherwise
        """
        try:
            response = requests.get(url, stream=True)
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                logger.info(f"Downloaded file to {output_path}")
                return True
            else:
                logger.error(f"Failed to download file: {response.status_code} - {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            return False

class VideoCropper:
    """Utility for cropping videos to keep the dancer centered"""
    
    @staticmethod
    def compute_dancer_bounding_box(pose_data: Dict[str, Any]) -> Tuple[float, float, float, float]:
        """Compute a bounding box around the dancer from pose data
        
        Args:
            pose_data: Pose data from the detector
        
        Returns:
            Tuple[float, float, float, float]: left, top, right, bottom coordinates (0-1 normalized)
        """
        # Check if there's pose data
        if not pose_data or 'poses' not in pose_data or not pose_data['poses']:
            logger.warning("No pose data available for computing bounding box")
            return 0, 0, 1, 1  # Default to full frame
        
        # If there's a selected pose, use that one, otherwise use the first one
        selected_idx = pose_data.get('selected_pose_index', 0)
        if selected_idx is not None and selected_idx < len(pose_data['poses']):
            pose = pose_data['poses'][selected_idx]
        else:
            pose = pose_data['poses'][0]
        
        # Get the bounding box
        bbox = pose.get('bbox', {})
        x_min = bbox.get('x_min', 0)
        y_min = bbox.get('y_min', 0)
        x_max = bbox.get('x_max', 1)
        y_max = bbox.get('y_max', 1)
        
        # Add some padding (20%)
        width = x_max - x_min
        height = y_max - y_min
        padding_x = width * 0.2
        padding_y = height * 0.2
        
        x_min = max(0, x_min - padding_x)
        y_min = max(0, y_min - padding_y)
        x_max = min(1, x_max + padding_x)
        y_max = min(1, y_max + padding_y)
        
        return x_min, y_min, x_max, y_max
    
    @staticmethod
    async def crop_video(input_path: Path, output_path: Path, bbox: Tuple[float, float, float, float]) -> bool:
        """Crop a video based on a bounding box
        
        Args:
            input_path: Path to the input video
            output_path: Path to save the cropped video
            bbox: Tuple (left, top, right, bottom) of normalized coordinates (0-1)
        
        Returns:
            bool: True if the crop was successful, False otherwise
        """
        try:
            # Get video properties
            cap = cv2.VideoCapture(str(input_path))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            logger.info(f"Video properties: {width}x{height}, {fps} FPS, {total_frames} frames")
            
            # Convert normalized coordinates to pixel values
            left, top, right, bottom = bbox
            x = int(left * width)
            y = int(top * height)
            w = int((right - left) * width)
            h = int((bottom - top) * height)
            
            logger.info(f"Cropping to: x={x}, y={y}, w={w}, h={h}")
            
            # Create video writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(output_path), fourcc, fps, (w, h))
            
            if not writer.isOpened():
                logger.error(f"Could not open video writer to {output_path}")
                return False
            
            # Process each frame
            frame_count = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Crop the frame
                cropped = frame[y:y+h, x:x+w]
                writer.write(cropped)
                
                frame_count += 1
                if frame_count % 100 == 0:
                    logger.info(f"Processed {frame_count}/{total_frames} frames")
            
            # Release resources
            cap.release()
            writer.release()
            
            logger.info(f"Successfully cropped video to {output_path}")
            return True
        
        except Exception as e:
            logger.error(f"Error cropping video: {str(e)}")
            return False

async def process_video_with_deepmotion(video_path: Path, pose_data: Dict[str, Any], output_dir: Path = OUTPUT_DIR) -> Dict[str, Any]:
    """Process a video with DeepMotion to create a 3D animation
    
    Args:
        video_path: Path to the input video
        pose_data: Pose data from the detector
        output_dir: Directory to save the output files
    
    Returns:
        Dict: Results of the operation including paths to output files
    """
    result = {
        "success": False,
        "message": "",
        "output_files": {}
    }
    
    # Create a temporary directory for intermediate files
    temp_dir = Path(tempfile.mkdtemp(dir=TEMP_DIR))
    
    try:
        # Initialize the DeepMotion API client
        deepmotion_api = DeepMotionAPI(
            client_id=DEEPMOTION_CLIENT_ID,
            client_secret=DEEPMOTION_CLIENT_SECRET,
            api_host=DEEPMOTION_API_HOST
        )
        
        # Authenticate with the DeepMotion API
        auth_success = await deepmotion_api.authenticate()
        if not auth_success:
            result["message"] = "Failed to authenticate with DeepMotion API"
            return result
        
        # Compute bounding box for the dancer
        bbox = VideoCropper.compute_dancer_bounding_box(pose_data)
        logger.info(f"Computed bounding box: {bbox}")
        
        # Crop the video to focus on the dancer
        cropped_video_path = temp_dir / f"{video_path.stem}_cropped{video_path.suffix}"
        crop_success = await VideoCropper.crop_video(video_path, cropped_video_path, bbox)
        
        if not crop_success:
            result["message"] = "Failed to crop video"
            return result
        
        # Get upload URL for the cropped video
        upload_url = await deepmotion_api.get_upload_url(cropped_video_path.name)
        if not upload_url:
            result["message"] = "Failed to get upload URL"
            return result
        
        # Upload the cropped video
        upload_success = await deepmotion_api.upload_file(cropped_video_path, upload_url)
        if not upload_success:
            result["message"] = "Failed to upload video"
            return result
        
        # Start processing with DeepMotion
        request_id = await deepmotion_api.start_processing(upload_url, {
            "left": bbox[0],
            "top": bbox[1],
            "right": bbox[2],
            "bottom": bbox[3]
        })
        
        if not request_id:
            result["message"] = "Failed to start processing"
            return result
        
        # Wait for the job to complete
        status_info = await deepmotion_api.wait_for_completion(request_id)
        
        if status_info["status"] != "SUCCESS":
            result["message"] = f"Processing failed: {status_info.get('details', 'Unknown error')}"
            return result
        
        # Get download URLs for the processed files
        links_info = await deepmotion_api.get_download_urls(request_id)
        
        if "urls" not in links_info:
            result["message"] = "No download URLs available"
            return result
        
        # Download the output files
        output_files = {}
        for url_group in links_info.get("urls", []):
            for file_entry in url_group.get("files", []):
                for file_type, url in file_entry.items():
                    output_file_path = output_dir / f"{video_path.stem}_{request_id}.{file_type}"
                    download_success = await deepmotion_api.download_file(url, output_file_path)
                    
                    if download_success:
                        output_files[file_type] = str(output_file_path)
                    else:
                        logger.warning(f"Failed to download {file_type} file")
        
        result["success"] = True
        result["message"] = "Successfully processed video"
        result["output_files"] = output_files
        result["request_id"] = request_id
        
        return result
    
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        result["message"] = f"Error: {str(e)}"
        return result
    
    finally:
        # Clean up temporary files
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to clean up temporary directory: {str(e)}")

# Main handler function to be called from external modules
async def create_3d_animation_from_video(video_path: str, pose_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a 3D animation from a video using DeepMotion
    
    Args:
        video_path: Path to the input video
        pose_data: Pose data from the detector
    
    Returns:
        Dict: Results of the operation
    """
    video_path = Path(video_path)
    if not video_path.exists():
        return {
            "success": False,
            "message": f"Video file not found: {video_path}"
        }
    
    return await process_video_with_deepmotion(video_path, pose_data)

# Commented out version of the main code for the user's request:
"""
# Implementation of video cropping and DeepMotion API integration

import os
import cv2
import json
import time
import logging
import requests
import numpy as np
import base64
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
import tempfile
import urllib.parse
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("video_processor")

# Try to import config settings
try:
    from config.settings import (
        DEEPMOTION_CLIENT_ID,
        DEEPMOTION_CLIENT_SECRET,
        DEEPMOTION_API_HOST,
        TEMP_DIR,
        OUTPUT_DIR,
    )
except ImportError:
    # Fallback to environment variables
    DEEPMOTION_CLIENT_ID = os.getenv("DEEPMOTION_CLIENT_ID", "")
    DEEPMOTION_CLIENT_SECRET = os.getenv("DEEPMOTION_CLIENT_SECRET", "")
    DEEPMOTION_API_HOST = os.getenv("DEEPMOTION_API_HOST", "https://animate3d.deepmotion.com")
    TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/dance_flow"))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/dance_flow/output"))

# Create directories if they don't exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class DeepMotionAPI:
    # DeepMotion API implementation
    
    def __init__(self, client_id: str, client_secret: str, api_host: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_host = api_host
        self.session_cookie = None
    
    async def authenticate(self) -> bool:
        # Authentication logic
        pass
    
    async def get_upload_url(self, filename: str) -> Optional[str]:
        # Get upload URL logic
        pass
    
    async def upload_file(self, file_path: Path, upload_url: str) -> bool:
        # Upload file logic
        pass
    
    async def start_processing(self, upload_url: str, crop_params: Optional[Dict] = None) -> Optional[str]:
        # Start processing logic
        pass
    
    async def poll_status(self, request_id: str) -> Dict[str, Any]:
        # Poll status logic
        pass
    
    async def wait_for_completion(self, request_id: str, max_attempts: int = 60, delay: int = 5) -> Dict[str, Any]:
        # Wait for completion logic
        pass
    
    async def get_download_urls(self, request_id: str) -> Dict[str, Any]:
        # Get download URLs logic
        pass
    
    async def download_file(self, url: str, output_path: Path) -> bool:
        # Download file logic
        pass

class VideoCropper:
    # Video cropping utilities
    
    @staticmethod
    def compute_dancer_bounding_box(pose_data: Dict[str, Any]) -> Tuple[float, float, float, float]:
        # Compute bounding box logic
        pass
    
    @staticmethod
    async def crop_video(input_path: Path, output_path: Path, bbox: Tuple[float, float, float, float]) -> bool:
        # Crop video logic
        pass

async def process_video_with_deepmotion(video_path: Path, pose_data: Dict[str, Any], output_dir: Path = OUTPUT_DIR) -> Dict[str, Any]:
    # Process video with DeepMotion logic
    pass

async def create_3d_animation_from_video(video_path: str, pose_data: Dict[str, Any]) -> Dict[str, Any]:
    # Main handler function
    pass
""" 