# Guest Check-In Completion Testing Guide

## 🧪 Quick Testing Guide

### Prerequisites
- Backend server running (`encore run`)
- Frontend server running (in `frontend` directory)
- Valid authentication token
- At least one property created in the system

## Test Scenarios

### ✅ Test 1: Indian Guest Check-in (with room number)

**Input Data:**
```json
{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Rajesh Kumar",
  "email": "rajesh.kumar@example.com",
  "phone": "+919876543210",
  "address": "123 MG Road, Bangalore, Karnataka 560001",
  "aadharNumber": "123456789012",
  "panNumber": "ABCDE1234F",
  "roomNumber": "101",
  "numberOfGuests": 2,
  "expectedCheckoutDate": "2025-10-15"
}
```

**Expected Result:**
```
✅ Success Message: "Welcome Rajesh Kumar! Your check-in has been completed successfully. Room 101 is ready for you."
✅ Guest details saved to guest_checkins table
✅ Audit log created with action_type: "create_checkin"
✅ Check-in ID returned
✅ Check-in date recorded
```

**Verify in Database:**
```sql
-- Check guest record
SELECT * FROM guest_checkins 
WHERE email = 'rajesh.kumar@example.com' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check audit log
SELECT * FROM guest_audit_logs 
WHERE guest_name = 'Rajesh Kumar' 
AND action_type = 'create_checkin'
ORDER BY timestamp DESC 
LIMIT 1;
```

---

### ✅ Test 2: Indian Guest Check-in (without room number)

**Input Data:**
```json
{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Priya Sharma",
  "email": "priya.sharma@example.com",
  "phone": "+919123456789",
  "address": "456 Park Street, Mumbai, Maharashtra 400001",
  "aadharNumber": "987654321098",
  "numberOfGuests": 1
}
```

**Expected Result:**
```
✅ Success Message: "Welcome Priya Sharma! Your check-in has been completed successfully."
✅ Guest details saved without room number
✅ Audit log created
```

---

### ✅ Test 3: Foreign Guest Check-in (with room)

**Input Data:**
```json
{
  "propertyId": 1,
  "guestType": "foreign",
  "fullName": "John Smith",
  "email": "john.smith@example.com",
  "phone": "+14155551234",
  "address": "789 Market Street, San Francisco, CA 94102, USA",
  "passportNumber": "US123456789",
  "country": "United States",
  "visaType": "Tourist",
  "visaExpiryDate": "2025-12-31",
  "roomNumber": "205",
  "numberOfGuests": 2,
  "expectedCheckoutDate": "2025-10-20"
}
```

**Expected Result:**
```
✅ Success Message: "Welcome John Smith! Your check-in has been completed successfully. Room 205 is ready for you."
✅ All passport and visa details saved
✅ Audit log created
```

---

### ✅ Test 4: Check-in with Documents

**Input Data:**
```json
{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Amit Patel",
  "email": "amit.patel@example.com",
  "phone": "+919876543211",
  "address": "321 Lake Road, Delhi 110001",
  "aadharNumber": "456789123456",
  "roomNumber": "305",
  "numberOfGuests": 3,
  "dataSource": "aadhaar_scan",
  "documents": [
    {
      "documentType": "aadhaar_front",
      "fileData": "base64_encoded_image_data...",
      "filename": "aadhaar.jpg",
      "mimeType": "image/jpeg"
    },
    {
      "documentType": "pan_card",
      "fileData": "base64_encoded_image_data...",
      "filename": "pan.jpg",
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Expected Result:**
```
✅ Success Message: "Welcome Amit Patel! Your check-in has been completed successfully. We have received 2 document(s) and they are being processed. Room 305 is ready for you."
✅ Guest details saved
✅ 2 documents uploaded
✅ Document extraction processing in background
✅ Audit log created with document count
```

---

### ✅ Test 5: Failed Check-in (Missing Required Field)

**Input Data:**
```json
{
  "propertyId": 1,
  "guestType": "indian",
  "fullName": "Test User",
  "email": "test@example.com",
  "phone": "+919876543212",
  "address": "Test Address"
  // Missing aadharNumber (required for Indian guest)
}
```

**Expected Result:**
```
❌ Error Message: "Aadhar number is required for Indian guests"
✅ Audit log created with success: false
✅ Error message logged
✅ No guest record created
```

**Verify in Database:**
```sql
-- Check audit log for failed attempt
SELECT * FROM guest_audit_logs 
WHERE guest_name = 'Test User' 
AND success = false
ORDER BY timestamp DESC 
LIMIT 1;
```

---

## 🔍 Audit Log Verification

### Query Recent Check-ins
```sql
SELECT 
  timestamp,
  user_email,
  action_type,
  guest_name,
  success,
  duration_ms,
  action_details
FROM guest_audit_logs
WHERE action_type = 'create_checkin'
ORDER BY timestamp DESC
LIMIT 10;
```

### Query Failed Check-ins
```sql
SELECT 
  timestamp,
  user_email,
  guest_name,
  error_message,
  duration_ms
FROM guest_audit_logs
WHERE action_type = 'create_checkin'
  AND success = false
ORDER BY timestamp DESC
LIMIT 10;
```

### Performance Metrics
```sql
SELECT 
  action_type,
  COUNT(*) as total_actions,
  AVG(duration_ms) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  COUNT(CASE WHEN success = false THEN 1 END) as failed_count
FROM guest_audit_logs
WHERE action_type IN ('create_checkin', 'checkout_guest')
GROUP BY action_type;
```

---

## 🖥️ Frontend Testing

### Steps:
1. Navigate to Guest Check-In page
2. Select "Indian Guest" or "Foreign Guest"
3. Fill in all required fields
4. Include room number (optional)
5. Submit the form
6. **Observe:**
   - ✅ Success message appears with guest name
   - ✅ Room number mentioned if provided
   - ✅ Form clears after success
   - ✅ Redirects to landing page after 3 seconds

### Screenshot Checklist:
- [ ] Success message displays personalized greeting
- [ ] Room information appears when provided
- [ ] Message auto-dismisses after 3 seconds
- [ ] Form resets properly
- [ ] Navigation works correctly

---

## 🔧 API Testing with cURL

### Test Indian Guest Check-in
```bash
curl -X POST http://localhost:4000/guest-checkin/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "propertyId": 1,
    "guestType": "indian",
    "fullName": "Test Guest",
    "email": "test@example.com",
    "phone": "+919876543210",
    "address": "Test Address",
    "aadharNumber": "123456789012",
    "roomNumber": "101",
    "numberOfGuests": 1
  }'
```

**Expected Response:**
```json
{
  "id": 123,
  "message": "Welcome Test Guest! Your check-in has been completed successfully. Room 101 is ready for you.",
  "checkInDate": "2025-10-10T12:34:56.789Z"
}
```

### Test Audit Log Query
```bash
curl -X GET "http://localhost:4000/guest-checkin/audit-logs?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📊 Success Metrics

After testing, you should see:

✅ **Database Records:**
- Guest records in `guest_checkins` table
- Audit logs in `guest_audit_logs` table
- Documents in `guest_documents` table (if uploaded)

✅ **Success Messages:**
- Personalized with guest name
- Room information when provided
- Document count when documents uploaded

✅ **Audit Trail:**
- All successful check-ins logged
- All failed attempts logged
- Performance metrics recorded
- User information captured

✅ **User Experience:**
- Clear success feedback
- Personalized messaging
- Smooth form reset
- Automatic navigation

---

## 🐛 Troubleshooting

### Issue: No audit logs created
**Solution:** Check that audit log table exists and user has write permissions

### Issue: Success message not showing
**Solution:** Check browser console for errors, verify API response format

### Issue: Database errors
**Solution:** Run migrations, verify database connection, check table structure

### Issue: Performance issues
**Solution:** Check database indexes, monitor duration_ms in audit logs

---

## ✅ Test Completion Checklist

- [ ] Indian guest check-in works (with room)
- [ ] Indian guest check-in works (without room)
- [ ] Foreign guest check-in works (with room)
- [ ] Foreign guest check-in works (without room)
- [ ] Check-in with documents works
- [ ] Failed check-ins are logged
- [ ] Success messages are personalized
- [ ] Room information appears correctly
- [ ] Audit logs are created
- [ ] Database records are correct
- [ ] Frontend displays messages properly
- [ ] Form resets after success
- [ ] Navigation works correctly
- [ ] API endpoints respond correctly
- [ ] Error handling works properly

---

## 🎉 Expected Results Summary

**Success Rate:** 100% for valid inputs
**Response Time:** < 500ms average
**Audit Logging:** 100% coverage
**Data Persistence:** All fields saved correctly
**User Experience:** Personalized, clear, and smooth

The guest check-in system is now fully functional with complete audit logging and personalized success messages! 🚀

