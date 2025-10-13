#!/usr/bin/env python3
"""
Create a test PAN card image for testing document extraction
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_test_pan():
    # Create image
    width, height = 600, 400
    image = Image.new('RGB', (width, height), '#D2B48C')  # Tan background
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
    
    # PAN data
    pan_data = {
        'name': 'KATRINA UUENI',
        'pan_number': 'ABCDE1234F',
        'father_name': 'JOHN UUENI',
        'date_of_birth': '1990-10-19'
    }
    
    # Draw header
    draw.rectangle([0, 0, width, 60], fill='#8B4513')
    draw.text((20, 20), "INCOME TAX DEPARTMENT", font=font_large, fill='white')
    draw.text((20, 45), "GOVT. OF INDIA", font=font_medium, fill='white')
    
    # Draw PAN card content
    y_pos = 80
    draw.text((20, y_pos), "Permanent Account Number Card", font=font_medium, fill='black')
    draw.text((20, y_pos + 30), f"Name: {pan_data['name']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 55), f"Father's Name: {pan_data['father_name']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 80), f"Date of Birth: {pan_data['date_of_birth']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 105), f"PAN: {pan_data['pan_number']}", font=font_medium, fill='black')
    
    # Draw signature placeholder
    draw.rectangle([400, 150, 580, 200], outline='black', width=1)
    draw.text((420, 175), "Signature", font=font_small, fill='black')
    
    # Draw footer
    draw.text((20, height - 30), "This is a test PAN card for development purposes", font=font_small, fill='gray')
    
    # Save image
    image.save('pan.jpg', 'JPEG', quality=95)
    print("Created pan.jpg with Indian PAN card data")
    print()
    print("Expected extracted data:")
    print(f"Full Name: {pan_data['name']}")
    print(f"PAN Number: {pan_data['pan_number']}")
    print(f"Father's Name: {pan_data['father_name']}")
    print(f"Date of Birth: {pan_data['date_of_birth']}")

if __name__ == "__main__":
    create_test_pan()
