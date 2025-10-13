#!/usr/bin/env python3
"""
Create a test passport image with the Estonian passport data provided
This creates a simple text-based passport image for testing
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Estonian passport data from the image description
passport_data = {
    "type": "P",
    "country_code": "EST", 
    "surname": "UUENI",
    "given_name": "KATRINA",
    "personal_code": "49010195221",
    "date_of_birth": "19.10.1990",
    "document_number": "KF0250087",
    "citizenship": "EST",
    "sex": "N/F",
    "place_of_birth": "EST",
    "date_of_issue": "13.02.2023",
    "date_of_expiry": "13.02.2033",
    "authority": "PPA/PBGB",
    "mrz_line1": "P<ESTUUENI<<KATRINA<<<<<<<<<<<<",
    "mrz_line2": "KF02500875EST9010196F330213049010195221<<<08"
}

def create_passport_image():
    # Create a white background image (passport size approximation)
    width, height = 600, 400
    image = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(image)
    
    try:
        # Try to use a system font
        font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 16)
        font_medium = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 12)
        font_small = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 10)
    except:
        # Fallback to default font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw header
    draw.rectangle([10, 10, width-10, 50], outline='black', width=2)
    draw.text((20, 20), "ESTONIAN PASSPORT", font=font_large, fill='black')
    
    # Draw document type and country
    y_pos = 70
    draw.text((20, y_pos), f"Liik/Type: {passport_data['type']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 20), f"Riigi kood/Country code: {passport_data['country_code']}", font=font_medium, fill='black')
    
    # Draw personal information
    y_pos = 120
    draw.text((20, y_pos), f"1. Perekonnanimi / Surname: {passport_data['surname']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 20), f"2. Eesnimi / Given name: {passport_data['given_name']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 40), f"3. Isikukood / Personal code: {passport_data['personal_code']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 60), f"4. Kodakondsus / Citizenship: {passport_data['citizenship']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 80), f"5. Sünniaeg / Date of birth: {passport_data['date_of_birth']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 100), f"6. Sugu / Sex: {passport_data['sex']}", font=font_medium, fill='black')
    draw.text((20, y_pos + 120), f"7. Sünnikoht / Place of birth: Tallinn, Estonia", font=font_medium, fill='black')
    draw.text((20, y_pos + 140), f"8. Aadress / Address: Tallinn, Estonia", font=font_medium, fill='black')
    
    # Draw document details
    y_pos = 260
    draw.text((300, y_pos), f"Dokumendi number: {passport_data['document_number']}", font=font_medium, fill='black')
    draw.text((300, y_pos + 20), f"8. Välja antud: {passport_data['date_of_issue']}", font=font_medium, fill='black')
    draw.text((300, y_pos + 40), f"9. Kehtiv kuni: {passport_data['date_of_expiry']}", font=font_medium, fill='black')
    draw.text((300, y_pos + 60), f"11. Väljaandja: {passport_data['authority']}", font=font_medium, fill='black')
    draw.text((300, y_pos + 80), f"Address: Police and Border Guard Board, Tallinn, Estonia", font=font_medium, fill='black')
    
    # Draw MRZ at bottom
    y_pos = height - 60
    draw.rectangle([10, y_pos, width-10, height-10], outline='black', width=1)
    draw.text((15, y_pos + 10), passport_data['mrz_line1'], font=font_small, fill='black')
    draw.text((15, y_pos + 25), passport_data['mrz_line2'], font=font_small, fill='black')
    
    return image

if __name__ == "__main__":
    # Create the passport image
    passport_img = create_passport_image()
    
    # Save as JPEG
    passport_img.save("passport.jpg", "JPEG", quality=95)
    print("Created passport.jpg with Estonian passport data")
    
    # Print the data that should be extracted
    print("\nExpected extracted data:")
    print(f"Full Name: {passport_data['surname']}, {passport_data['given_name']}")
    print(f"Passport Number: {passport_data['document_number']}")
    print(f"Nationality: Estonia")
    print(f"Date of Birth: 1990-10-19")
    print(f"Expiry Date: 2033-02-13")
    print(f"Issue Date: 2023-02-13")
