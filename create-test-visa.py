#!/usr/bin/env python3
"""
Create a test visa image with the Indian visa data provided
This creates a simple text-based visa image for testing
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Indian visa data from the image description - Enhanced for FRRO C-Form
visa_data = {
    "visa_type": "Tourist",
    "visa_category": "e-Visa",
    "visa_number": "900F3927P",
    "country": "India",
    "authority": "BUREAU OF IMMIGRATION INDIA",
    "issue_date": "14 MAR 2025",
    "expiry_date": "09 Mar 2026",
    "place_of_issue": "New Delhi",
    "purpose_of_visit": "Tourism",
    "port_of_entry": "IGI AIRPORT, NEW DELHI",
    "entries": "MULTIPLE",
    "stay_duration": "Each Stay not to exceed 90 days",
    "nationality": "Estonia",
    "passport_number": "KF0250087",
    "visa_status": "Active",
    "remarks": "Valid for tourism and leisure activities",
    "code": "C4"
}

def create_visa_image():
    # Create a white background image (visa size approximation)
    width, height = 500, 350
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    try:
        # Try to use a system font
        font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 14)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 11)
        font_small = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 9)
    except:
        # Fallback to default font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw header
    draw.rectangle([10, 10, width-10, 50], outline='black', width=2)
    draw.text((20, 20), "INDIAN VISA", font=font_large, fill='black')
    
    # Draw visa details
    y_pos = 70
    draw.text((20, y_pos), f"Visa Type: {visa_data['visa_type']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 20), f"Visa Category: {visa_data['visa_category']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 40), f"Visa Number: {visa_data['visa_number']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 60), f"Country: {visa_data['country']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 80), f"Authority: {visa_data['authority']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 100), f"Place of Issue: {visa_data['place_of_issue']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 120), f"Purpose: {visa_data['purpose_of_visit']}", font=font_medium, fill='black')
    
    # Draw dates
    y_pos = 200
    draw.text((20, y_pos), f"Issue Date: {visa_data['issue_date']}", font=font_medium, fill='red')
    draw.text((20, y_pos + 20), f"Expiry Date: {visa_data['expiry_date']}", font=font_medium, fill='black')
    
    # Draw entry details and additional FRRO fields
    y_pos = 250
    draw.text((20, y_pos), f"Port of Entry: {visa_data['port_of_entry']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 20), f"Entries: {visa_data['entries']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 40), f"Stay Duration: {visa_data['stay_duration']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 60), f"Nationality: {visa_data['nationality']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 80), f"Passport No: {visa_data['passport_number']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 100), f"Status: {visa_data['visa_status']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 120), f"Remarks: {visa_data['remarks']}", font=font_medium, fill='black')
    
    # Draw border
    draw.rectangle([5, 5, width-5, height-5], outline='blue', width=3)
    
    # Adjust image height to fit all content
    return image.resize((width, 450))

if __name__ == "__main__":
    # Create the visa image
    visa_img = create_visa_image()
    
    # Save as JPEG
    visa_img.save("visa.jpg", "JPEG", quality=95)
    print("Created visa.jpg with Indian visa data")
    
    # Print the data that should be extracted
    print("\nExpected extracted data (FRRO C-Form Ready):")
    print(f"Visa Type: {visa_data['visa_type']}")
    print(f"Visa Category: {visa_data['visa_category']}")
    print(f"Visa Number: {visa_data['visa_number']}")
    print(f"Country: {visa_data['country']}")
    print(f"Place of Issue: {visa_data['place_of_issue']}")
    print(f"Purpose of Visit: {visa_data['purpose_of_visit']}")
    print(f"Issue Date: 2025-03-14")
    print(f"Expiry Date: 2026-03-09")
    print(f"Port of Entry: {visa_data['port_of_entry']}")
    print(f"Entries: {visa_data['entries']}")
    print(f"Duration of Stay: {visa_data['stay_duration']}")
    print(f"Nationality: {visa_data['nationality']}")
    print(f"Passport Number: {visa_data['passport_number']}")
    print(f"Visa Status: {visa_data['visa_status']}")
    print(f"Remarks: {visa_data['remarks']}")
