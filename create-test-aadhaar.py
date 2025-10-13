#!/usr/bin/env python3
"""
Create a test Aadhaar card image for testing document extraction
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_test_aadhaar():
    # Create image
    width, height = 600, 400
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 24)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
        font_small = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Aadhaar data
    aadhaar_data = {
        'name': 'KATRINA UUENI',
        'aadhaar_number': '1234 5678 9012',
        'date_of_birth': '1990-10-19',
        'address': 'Tallinn, Estonia',
        'gender': 'Female',
        'father_name': 'JOHN UUENI'
    }
    
    # Draw header
    draw.rectangle([0, 0, width, 60], fill='#FF6B35')
    draw.text((20, 20), "Government of India", font=font_large, fill='white')
    draw.text((20, 45), "Aadhaar", font=font_medium, fill='white')
    
    # Draw main content
    y_pos = 80
    draw.text((20, y_pos), f"Name: {aadhaar_data['name']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 25), f"Aadhaar No: {aadhaar_data['aadhaar_number']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 50), f"Date of Birth: {aadhaar_data['date_of_birth']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 75), f"Gender: {aadhaar_data['gender']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 100), f"Father's Name: {aadhaar_data['father_name']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 125), f"Address: {aadhaar_data['address']}", font=font_medium, fill='black')
    
    # Draw QR code placeholder
    draw.rectangle([400, 80, 580, 260], outline='black', width=2)
    draw.text((420, 170), "QR Code", font=font_small, fill='black')
    
    # Draw footer
    draw.text((20, height - 30), "This is a test Aadhaar card for development purposes", font=font_small, fill='gray')
    
    # Save image
    image.save('aadhaar.jpg', 'JPEG', quality=95)
    print("Created aadhaar.jpg with Indian Aadhaar data")
    print()
    print("Expected extracted data:")
    print(f"Full Name: {aadhaar_data['name']}")
    print(f"Aadhaar Number: {aadhaar_data['aadhaar_number']}")
    print(f"Date of Birth: {aadhaar_data['date_of_birth']}")
    print(f"Address: {aadhaar_data['address']}")
    print(f"Gender: {aadhaar_data['gender']}")

if __name__ == "__main__":
    create_test_aadhaar()
