# Knowledge Store - Flexible Knowledge Management

## Not Just Q&A - Store ANY Knowledge

The knowledge store is designed to handle all types of information, not just question-answer pairs. The AI will search through everything and find relevant information based on context.

## Types of Knowledge You Can Store

### 1. Traditional Q&A
**Topic:** "Gift card purchase"  
**Knowledge:** "Visit www.clubhouse247golf.com/giftcard/purchase"  
*AI finds this when asked about gift cards, vouchers, presents, etc.*

### 2. General Facts & Information
**Topic:** "Facility details"  
**Knowledge:** 
```
Bedford: 10 bays, 2 putting greens, full bar
Dartmouth: 8 bays, 1 putting green, coffee bar
Stratford: 6 bays, outdoor patio
Bayers Lake: 12 bays, restaurant, event space
```
*AI uses this for any facility-related questions*

### 3. Current Situations
**Topic:** "Bay 5 status"  
**Knowledge:** "Bay 5 trackman is being serviced today, will be back online tomorrow"  
*AI knows to inform customers about this bay*

### 4. Procedures & Instructions
**Topic:** "Trackman troubleshooting"  
**Knowledge:**
```
Common fixes:
1. Ball not tracking: Clean the lens with microfiber cloth
2. Screen frozen: Windows key → cmd → trackman-reset.bat
3. No power: Check breaker panel in utility closet
4. Calibration off: Run auto-calibration from settings menu
```
*AI can guide through troubleshooting step by step*

### 5. Policies & Rules
**Topic:** "Membership benefits"  
**Knowledge:**
```
Gold Members:
- 20% off simulator time
- Priority booking
- Free guest passes (4/month)
- Access to member events

Silver Members:
- 10% off simulator time
- 2 guest passes/month
```
*AI accurately explains membership tiers*

### 6. Historical/Contextual Information
**Topic:** "Recent updates"  
**Knowledge:** "New Titleist Pro V1x balls arrived last week. TaylorMade drivers coming next month."  
*AI can mention recent changes when relevant*

### 7. Contact Information
**Topic:** "Emergency contacts"  
**Knowledge:**
```
HVAC Issues: Arctic Air 902-555-COOL (24/7)
Plumbing: Flow Masters 902-555-PIPE
IT Support: Mike 902-555-TECH
Facilities Manager: Sarah 902-555-MGMT
```
*AI provides correct contacts based on issue type*

### 8. Seasonal/Temporary Information
**Topic:** "Holiday hours"  
**Knowledge:** "Christmas Eve: 9am-5pm, Christmas Day: Closed, Boxing Day: 12pm-11pm"  
*AI gives current holiday schedule*

### 9. Marketing/Promotional Content
**Topic:** "Current promotions"  
**Knowledge:**
```
August Specials:
- Happy Hour 3-5pm weekdays: 30% off
- Student Sundays: $25/hour with valid ID
- League Night Thursdays: Team packages available
```
*AI promotes current offers when appropriate*

### 10. Technical Specifications
**Topic:** "Simulator specs"  
**Knowledge:**
```
Trackman 4 units:
- Dual radar technology
- 4K impact cameras
- Measures 30+ data parameters
- Accuracy: ±1 yard on carry distance
- Compatible with TGC 2019, E6 Connect
```
*AI can answer technical questions accurately*

## How the AI Searches

When someone asks: **"What time do you close?"**

The AI searches for keywords:
- "hours" ✓
- "close" ✓
- "time" ✓
- "schedule" ✓

Finds: Topic "Hours" → "Open 24/7, 365 days a year"

When someone asks: **"The screen in bay 3 is weird"**

The AI searches for:
- "bay 3" ✓
- "screen" ✓
- "problem" (inferred)

Might find:
- "Bay 3 status" → Current issues
- "Trackman troubleshooting" → Screen problems
- "TV troubleshooting" → Display issues

## Best Practices

### DO:
✅ **Store current information** - "Bay 5 under maintenance today"  
✅ **Include multiple related terms** - Gift cards, vouchers, certificates  
✅ **Add context** - "Valid until Sept 30" for promotions  
✅ **Be specific** - "Bedford location" vs just "location"  
✅ **Update regularly** - Remove outdated info  

### DON'T:
❌ **Store sensitive data** - Passwords, credit cards  
❌ **Include personal information** - Customer names, phone numbers  
❌ **Use internal jargon** - Customers won't understand "T4 unit"  
❌ **Store conflicting info** - Multiple different WiFi passwords  

## Bulk Upload Format

Create a .txt file with mixed content:

```text
=== FACILITIES ===
Bedford: 10 bays, full restaurant, 180 Bluewater Rd
Dartmouth: 8 bays, coffee bar, 15 Spectacle Lake Dr
Stratford: 6 bays, patio, Coming 2025
Bayers Lake: 12 bays, event space, 201 Chain Lake Dr

=== COMMON ISSUES ===
Trackman frozen: Windows key, cmd, trackman-reset.bat
Ball not tracking: Clean the lens with microfiber cloth
TV no signal: Press Input button, select HDMI 1

=== CURRENT PROMOTIONS ===
Happy Hour: 3-5pm weekdays, 30% off simulator time
Student Special: Sundays with valid ID, $25/hour
Corporate Events: Custom packages available

=== CONTACT INFO ===
General: 902-555-GOLF
Emergency Facilities: 902-555-9999
Events: events@clubhouse247golf.com
```

The system will parse and create searchable entries from all sections!

## The Power of Flexible Knowledge

Instead of trying to predict every possible question, just store the knowledge. The AI will:
1. Search through everything
2. Find relevant pieces
3. Combine them intelligently
4. Provide accurate answers

This approach is more natural and maintainable than rigid Q&A pairs!