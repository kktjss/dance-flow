import sys
import os
import unittest
import numpy as np
import cv2
import tempfile
from unittest.mock import patch, MagicMock
import json

# Add the server/python directory to path so imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../server/python')))

# Import the video_processor module
from video_analyzer.video_processor import (
    VideoProcessor, extract_video_frames, compare_poses, calculate_pose_similarity,
    analyze_dance_video, process_comparison
)

class TestVideoProcessor(unittest.TestCase):
    
    def setUp(self):
        # Create temporary test files
        self.temp_dir = tempfile.TemporaryDirectory()
        
        # Create a small test video
        self.test_video_path = os.path.join(self.temp_dir.name, "test_video.mp4")
        self._create_test_video(self.test_video_path)
        
        # Create sample poses for testing
        self.pose1 = [
            {"x": 0.5, "y": 0.3, "z": 0.1, "v": 0.9},  # Nose
            {"x": 0.51, "y": 0.31, "z": 0.11, "v": 0.9},  # Left eye
            {"x": 0.49, "y": 0.31, "z": 0.11, "v": 0.9},  # Right eye
            # More keypoints would be added for a real pose
        ]
        
        self.pose2 = [
            {"x": 0.52, "y": 0.32, "z": 0.12, "v": 0.9},  # Nose - slightly different
            {"x": 0.53, "y": 0.33, "z": 0.13, "v": 0.9},  # Left eye
            {"x": 0.51, "y": 0.33, "z": 0.13, "v": 0.9},  # Right eye
            # More keypoints would be added for a real pose
        ]
        
        # Create a mock model for pose detection
        self.mock_model = MagicMock()
        self.mock_model.detect.return_value = {
            "poses": [self.pose1],
            "scores": [0.95]
        }
    
    def tearDown(self):
        # Clean up temporary files
        self.temp_dir.cleanup()
    
    def _create_test_video(self, path, frames=30, width=640, height=480):
        """Create a simple test video file with a moving rectangle"""
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(path, fourcc, 15, (width, height))
        
        for i in range(frames):
            # Create a blank frame
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            
            # Draw a rectangle moving from left to right
            x_pos = int(i * (width - 100) / frames)
            cv2.rectangle(frame, (x_pos, 200), (x_pos + 100, 300), (0, 255, 0), -1)
            
            # Add the frame to the video
            writer.write(frame)
        
        writer.release()
    
    def test_video_processor_initialization(self):
        """Test initializing the VideoProcessor class"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Check that the processor was initialized correctly
        self.assertEqual(processor.video_path, self.test_video_path)
        self.assertIsNotNone(processor.cap)
        self.assertIsNotNone(processor.fps)
        self.assertIsNotNone(processor.total_frames)
        self.assertEqual(processor.model, self.mock_model)
    
    def test_extract_video_frames(self):
        """Test extracting frames from a video file"""
        frames = extract_video_frames(self.test_video_path, max_frames=10)
        
        # Check that we got the expected number of frames
        self.assertLessEqual(len(frames), 10)
        
        # Check that the frames have the expected shape
        self.assertEqual(frames[0].shape, (480, 640, 3))
    
    def test_compare_poses(self):
        """Test comparing two poses for similarity"""
        similarity = compare_poses(self.pose1, self.pose2)
        
        # Poses are slightly different, so similarity should be < 1.0 but > 0
        self.assertLess(similarity, 1.0)
        self.assertGreater(similarity, 0.0)
        
        # Same pose should be perfectly similar
        self.assertEqual(compare_poses(self.pose1, self.pose1), 1.0)
    
    def test_calculate_pose_similarity(self):
        """Test calculating pose similarity with different weights"""
        # Define weights for different body parts
        weights = {
            "upper_body": 0.6,
            "lower_body": 0.4
        }
        
        similarity = calculate_pose_similarity(self.pose1, self.pose2, weights)
        
        # Similarity should be a value between 0 and 1
        self.assertGreaterEqual(similarity, 0.0)
        self.assertLessEqual(similarity, 1.0)
    
    @patch('video_analyzer.video_processor.extract_video_frames')
    def test_analyze_dance_video(self, mock_extract_frames):
        """Test analyzing a dance video against a reference"""
        # Mock frame extraction to return a sequence of 5 frames
        mock_frames = [np.zeros((480, 640, 3), dtype=np.uint8) for _ in range(5)]
        mock_extract_frames.return_value = mock_frames
        
        # Mock the pose detection model
        mock_model = MagicMock()
        mock_model.detect.return_value = {
            "poses": [self.pose1],
            "scores": [0.95]
        }
        
        # Create reference video path
        ref_video_path = os.path.join(self.temp_dir.name, "reference.mp4")
        self._create_test_video(ref_video_path)
        
        # Analyze the dance video
        results = analyze_dance_video(
            self.test_video_path, 
            ref_video_path,
            model=mock_model,
            sample_rate=1.0
        )
        
        # Check results structure
        self.assertIn("overall_score", results)
        self.assertIn("timing", results)
        self.assertIn("technique", results)
        self.assertIn("frame_scores", results)
        
        # Check that overall score is between 0 and 100
        self.assertGreaterEqual(results["overall_score"], 0)
        self.assertLessEqual(results["overall_score"], 100)
        
        # Timing and technique scores should be between 0 and 100
        self.assertGreaterEqual(results["timing"]["score"], 0)
        self.assertLessEqual(results["timing"]["score"], 100)
        self.assertGreaterEqual(results["technique"]["score"], 0)
        self.assertLessEqual(results["technique"]["score"], 100)
        
        # Should have extracted frames from both videos
        self.assertEqual(mock_extract_frames.call_count, 2)
    
    def test_process_comparison(self):
        """Test processing comparison between dancer and reference poses"""
        # Create artificial synchronized dance and reference pose sequences
        dance_sequence = [self.pose1, self.pose2, self.pose1] * 3
        reference_sequence = [self.pose1, self.pose1, self.pose2] * 3
        
        # Process comparison between sequences
        result = process_comparison(
            dance_sequence, 
            reference_sequence,
            fps=15.0
        )
        
        # Check results structure
        self.assertIn("frame_scores", result)
        self.assertIn("timing_score", result)
        self.assertIn("technique_score", result)
        self.assertIn("overall_score", result)
        
        # Check that scores are between 0 and 100
        self.assertGreaterEqual(result["overall_score"], 0)
        self.assertLessEqual(result["overall_score"], 100)
        self.assertGreaterEqual(result["timing_score"], 0)
        self.assertLessEqual(result["timing_score"], 100)
        self.assertGreaterEqual(result["technique_score"], 0)
        self.assertLessEqual(result["technique_score"], 100)
        
        # Should have frame scores for each frame
        self.assertEqual(len(result["frame_scores"]), len(dance_sequence))
    
    def test_video_processor_get_frame(self):
        """Test getting a specific frame from the video"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Get the first frame
        frame = processor.get_frame(0)
        
        # Check that we got a valid frame
        self.assertIsNotNone(frame)
        self.assertEqual(frame.shape, (480, 640, 3))
        
        # Try getting a frame past the end of the video
        with self.assertRaises(ValueError):
            processor.get_frame(1000)
    
    def test_video_processor_detect_poses_in_frame(self):
        """Test detecting poses in a specific frame"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Get the first frame
        frame = processor.get_frame(0)
        
        # Detect poses in the frame
        poses = processor.detect_poses_in_frame(frame)
        
        # Check that we got valid poses
        self.assertIsNotNone(poses)
        self.assertEqual(len(poses), 1)  # Our mock model returns one pose
        
        # Check that the mock model was called
        self.mock_model.detect.assert_called_once()
    
    def test_video_processor_process_frames(self):
        """Test processing multiple frames"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Process the first 5 frames
        results = processor.process_frames(frame_indices=[0, 1, 2, 3, 4])
        
        # Check that we got valid results
        self.assertIsNotNone(results)
        self.assertEqual(len(results), 5)
        
        # Check that each result contains poses
        for result in results:
            self.assertIn("poses", result)
            self.assertIn("frame_index", result)
    
    def test_video_processor_to_json(self):
        """Test converting processor results to JSON"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Process some frames
        results = processor.process_frames(frame_indices=[0, 1, 2])
        
        # Convert to JSON
        json_data = processor.to_json(results)
        
        # Check that the result is valid JSON
        parsed = json.loads(json_data)
        self.assertIsInstance(parsed, list)
        self.assertEqual(len(parsed), 3)
        
        # Check structure of JSON
        for item in parsed:
            self.assertIn("frame_index", item)
            self.assertIn("poses", item)
            self.assertIsInstance(item["poses"], list)
    
    def test_video_processor_close(self):
        """Test closing the video processor"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Call some methods to ensure the video is open
        processor.get_frame(0)
        
        # Close the processor
        processor.close()
        
        # VideoCapture should be closed
        self.assertEqual(processor.cap, None)

if __name__ == '__main__':
    unittest.main() 