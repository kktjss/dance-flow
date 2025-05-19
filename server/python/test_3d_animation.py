"""
Тестовый скрипт для функционала 3D анимации
====================================
Этот скрипт демонстрирует, как использовать конечную точку API 3D анимации.
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path
import requests

def main():
    parser = argparse.ArgumentParser(description='Тестирование API 3D анимации')
    parser.add_argument('--video', type=str, required=True, help='Путь к входному видеофайлу')
    parser.add_argument('--x', type=int, default=None, help='X координата танцора (опционально)')
    parser.add_argument('--y', type=int, default=None, help='Y координата танцора (опционально)')
    parser.add_argument('--host', type=str, default='http://localhost:8000', help='URL хоста API')
    args = parser.parse_args()
    
    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Ошибка: Видеофайл не найден: {video_path}")
        return 1
    
    print(f"Тестирование API 3D анимации с видео: {video_path}")
    
    # Подготовка запроса
    url = f"{args.host}/create-3d-animation"
    params = {}
    if args.x is not None and args.y is not None:
        params['click_x'] = args.x
        params['click_y'] = args.y
    
    # Отправка запроса
    with open(video_path, 'rb') as f:
        files = {'file': (video_path.name, f, 'video/mp4')}
        print(f"Отправка запроса на {url}")
        response = requests.post(url, params=params, files=files)
    
    # Вывод ответа
    if response.status_code == 200:
        data = response.json()
        print("Ответ API:")
        print(f"  Успех: {data.get('success', False)}")
        print(f"  Сообщение: {data.get('message', '')}")
        
        if 'error' in data:
            print(f"  Ошибка: {data['error']}")
        
        if 'output_files' in data:
            print("  Выходные файлы:")
            for file_type, file_path in data['output_files'].items():
                print(f"    {file_type}: {file_path}")
    else:
        print(f"Ошибка: HTTP {response.status_code}")
        print(response.text)
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 