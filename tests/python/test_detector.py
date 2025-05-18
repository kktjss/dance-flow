import sys
import os
import unittest
import json
import numpy as np
import cv2
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add the server/python directory to path so imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../server/python')))

# Import the detector module and FastAPI app
from video_analyzer.detector import (
    _encode_jpeg, _encode_png, _process, check_memory_usage,
    _compute_frame_hash, _landmarks_to_json, app
)

class TestDetector(unittest.TestCase):
    
    def setUp(self):
        # Create test client
        self.client = TestClient(app)
        
        # Create a sample test image for processing
        # A simple black image with a white rectangle in the middle (simulating a person)
        self.test_image = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.rectangle(self.test_image, (220, 140), (420, 340), (255, 255, 255), -1)
        
        # Create a mock landmarks object for testing
        self.mock_landmarks = MagicMock()
        self.mock_landmarks.landmark = [
            # Mock 33 pose landmarks with x, y, z, visibility attributes
            MagicMock(x=0.5, y=0.3, z=0.1, visibility=0.95),  # Nose
            MagicMock(x=0.51, y=0.29, z=0.11, visibility=0.9),  # Left eye inner
            MagicMock(x=0.52, y=0.28, z=0.12, visibility=0.85),  # Left eye
            # ... add more mock landmarks as needed
        ]
    
    def test_encode_jpeg(self):
        """Test JPEG encoding function"""
        encoded = _encode_jpeg(self.test_image, 80)
        self.assertIsInstance(encoded, str)
        self.assertTrue(encoded.startswith('data:image/jpeg;base64,') or len(encoded) > 0)
    
    def test_encode_png(self):
        """Test PNG encoding function"""
        # Add alpha channel for PNG
        img_with_alpha = np.zeros((480, 640, 4), dtype=np.uint8)
        img_with_alpha[:, :, 3] = 255  # Set alpha channel to fully opaque
        
        encoded = _encode_png(img_with_alpha)
        self.assertIsInstance(encoded, str)
        self.assertTrue(encoded.startswith('data:image/png;base64,') or len(encoded) > 0)
    
    def test_compute_frame_hash(self):
        """Test frame hash computation"""
        hash1 = _compute_frame_hash(self.test_image)
        
        # Slightly modified image
        modified_image = self.test_image.copy()
        modified_image[240, 320] = [100, 100, 100]  # Change a single pixel
        
        hash2 = _compute_frame_hash(modified_image)
        
        self.assertIsInstance(hash1, str)
        self.assertNotEqual(hash1, hash2)
    
    def test_landmarks_to_json(self):
        """Test conversion of landmarks to JSON format"""
        json_landmarks = _landmarks_to_json(self.mock_landmarks)
        
        self.assertIsInstance(json_landmarks, list)
        self.assertGreater(len(json_landmarks), 0)
        
        # Check structure of first landmark
        first_landmark = json_landmarks[0]
        self.assertIn('x', first_landmark)
        self.assertIn('y', first_landmark)
        self.assertIn('z', first_landmark)
        self.assertIn('v', first_landmark)
        
        # Check values
        self.assertAlmostEqual(first_landmark['x'], 0.5)
        self.assertAlmostEqual(first_landmark['y'], 0.3)
        self.assertAlmostEqual(first_landmark['z'], 0.1)
        self.assertAlmostEqual(first_landmark['v'], 0.95)
    
    def test_check_memory_usage(self):
        """Test memory usage check function"""
        # This is more of a functional test - doesn't assert specific values
        result = check_memory_usage()
        self.assertIsInstance(result, bool)
    
    @patch('video_analyzer.detector.get_landmarker')
    def test_process_with_click_point(self, mock_get_landmarker):
        """Test processing with a click point"""
        # Create mock landmarker and results
        mock_landmarker = MagicMock()
        mock_results = MagicMock()
        
        # Set up mock pose landmarks
        mock_pose_landmark = MagicMock()
        mock_pose_landmark.pose_landmarks = [self.mock_landmarks]
        mock_pose_landmark.pose_world_landmarks = [self.mock_landmarks]
        
        # Configure mocks
        mock_get_landmarker.return_value = mock_landmarker
        mock_landmarker.detect.return_value = mock_pose_landmark
        
        # Test process with click point
        result = _process(
            frame=self.test_image,
            draw=True,
            ret_img=True,
            overlay=True,
            click_point=(320, 240)  # Click in the middle of the white rectangle
        )
        
        # Verify result structure
        self.assertIsInstance(result, dict)
        self.assertIn('found', result)
        self.assertIn('image', result)
        self.assertIn('poses', result)
        
        if result['found']:
            self.assertGreater(len(result['poses']), 0)
    
    def test_health_endpoint(self):
        """Test the health endpoint"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('status', data)
        self.assertEqual(data['status'], 'ok')
    
    def test_clear_cache_endpoint(self):
        """Test the clear cache endpoint"""
        response = self.client.get("/clear-cache")
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('message', data)
        self.assertIn('cleared', data['message'])
    
    @patch('video_analyzer.detector._process')
    def test_process_frame_endpoint(self, mock_process):
        """Test the process-frame endpoint"""
        # Configure mock to return a sample result
        mock_process.return_value = {
            'found': True,
            'image': 'data:image/jpeg;base64,test',
            'overlay': 'data:image/png;base64,test',
            'poses': [
                {'landmarks': [{'x': 0.5, 'y': 0.3, 'z': 0.1, 'v': 0.9}]},
            ],
            'selected_pose_idx': 0
        }
        
        # Create test image file
        _, test_img_path = os.path.split(__file__)
        test_img_path = "test_image.jpg"
        cv2.imwrite(test_img_path, self.test_image)
        
        try:
            # Test with file upload
            with open(test_img_path, 'rb') as img_file:
                response = self.client.post(
                    "/process-frame",
                    files={"file": ("test_image.jpg", img_file, "image/jpeg")},
                    params={
                        "image": 1,
                        "draw": 1,
                        "overlay": 1,
                        "resize": 1,
                        "click_x": 320,
                        "click_y": 240
                    }
                )
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Verify process was called correctly
            mock_process.assert_called_once()
            
            # Verify response structure
            self.assertIn('found', data)
            self.assertIn('image', data)
            self.assertIn('poses', data)
            
        finally:
            # Clean up test file
            if os.path.exists(test_img_path):
                os.remove(test_img_path)

if __name__ == '__main__':
    unittest.main() 