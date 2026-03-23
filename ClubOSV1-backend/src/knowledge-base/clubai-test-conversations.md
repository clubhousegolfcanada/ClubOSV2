# Test Conversations: AI Response vs Current Auto-Response

These are real conversations from your CSV. For each one, I show:
- What **actually happened** (generic auto-response → human had to step in)
- What **ClubAI would do** (handle it directly or smartly escalate)

---

## TEST 1: "What happens if the sim freezes"
**Intent:** sim_frozen | **AI Assessment:** ai_first_then_escalate

**What actually happened:**
```
CUSTOMER: What happens if the sim freezes
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto
              Booking changes? email: booking@clubhouse247golf.com
              Pricing, general info? www.clubhouse247golf.com
              Need more help? Reply here and we'll get back to you ASAP.
HUMAN STAFF: We can help. What location and box?
CUSTOMER: Truro box 3
HUMAN STAFF: If at least one person signed in to a trackman account you can always pick back up where you left off. I think you'll be able to resume anyways though.
HUMAN STAFF: You should be good to go
CUSTOMER: Ok perfect man thanks!
```
**4 human messages needed. Response delay while waiting for staff.**

**What ClubAI would do:**
```
CUSTOMER: What happens if the sim freezes
CLUBAI: No worries — here's a quick fix if it happens:
1. Press the Windows key on the keyboard
2. Find the green and orange TrackMan icons in the taskbar
3. Right-click each and close them
4. Reopen the orange icon from the desktop
5. Wait about a minute to load

If you have a TrackMan account, you can always resume from "My Activities." Let me know if you need a hand!
```
**0 human messages needed. Instant response. Customer gets the answer right away.**

---

## TEST 2: "Game keeps restarting on us"
**Intent:** sim_frozen | **AI Assessment:** ai_first_then_escalate

**What actually happened:**
```
CUSTOMER: Game keeps restarting on us. we can press start game again, but then after a shot it just brings us right back to that screen
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
HUMAN STAFF: (later) Let me do a full reset for you.
HUMAN STAFF: Feel free to stay until 9, If it keeps happening let us know. We will refund your booking, this one is on us!
...eventually refunded the booking
```
**Multiple human messages, customer waited for staff.**

**What ClubAI would do:**
```
CUSTOMER: Game keeps restarting on us. we can press start game again, but then after a shot it just brings us right back to that screen
CLUBAI: Sorry about that! Try this quick fix:
1. Press the Windows key
2. Close both the green and orange TrackMan icons in the taskbar (right-click → close)
3. Reopen the orange one from the desktop
4. Wait about a minute for it to load back up

That usually clears the restart loop. Let me know if it works!

CUSTOMER: Tried it, still doing the same thing
CLUBAI: Okay, I'm pulling in a team member to do a remote reset. What box and location are you in?

CUSTOMER: Box 4 Dartmouth
CLUBAI: Got it — someone will be right with you!
[ESCALATE TO HUMAN with full context]
```
**AI handles first attempt instantly. Human only needed for the remote reset — and gets full context when they jump in.**

---

## TEST 3: "Side TV screens aren't working"
**Intent:** side_screens | **AI Assessment:** ai_first_then_escalate

**What actually happened:**
```
CUSTOMER: The side TV screens aren't working. Is there a different way to set them?
HUMAN STAFF: Are they showing anything? If it says no view selected we would just need to do a trackman reset.
CUSTOMER: It says no view selected yes
CUSTOMER: We will hit a few more and switch to game. I will do a reset next time if that happens again. Thanks
```
**Human had to ask clarifying question, then explain the fix.**

**What ClubAI would do:**
```
CUSTOMER: The side TV screens aren't working. Is there a different way to set them?
CLUBAI: Are they completely off, or do they show "No View Selected"?

CUSTOMER: It says no view selected yes
CLUBAI: That's a quick fix! Press the Windows key, close both the green and orange TrackMan icons in the taskbar, then reopen the orange one from the desktop. Wait a minute and start your round — the side screens should connect automatically.

CUSTOMER: Thanks
CLUBAI: No problem, enjoy!
```
**0 human messages needed.**

---

## TEST 4: "QR code not logging us in"
**Intent:** login_qr_issue | **AI Assessment:** ai_first_then_escalate

**What actually happened:**
```
CUSTOMER: QR code not logging us in
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
(customer figured it out on their own)
CUSTOMER: Working. Thanks
HUMAN STAFF: Ok perfect
```

**What ClubAI would do:**
```
CUSTOMER: QR code not logging us in
CLUBAI: No worries — you don't need an account to play! Just select "Guest" on the screen and you're good to go. Your stats won't save but you can play right away.

For next time, you can create a TrackMan account through the app at home — makes it easier!
```
**Instant answer. No waiting.**

---

## TEST 5: "Hi, my first time at Clubhouse, just wondering if there's customer wifi"
**Intent:** wifi | **AI Assessment:** fully_ai

**What actually happened:**
```
CUSTOMER: Hi, my first time at Clubhouse, just wondering if there's customer wifi
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
HUMAN STAFF: yeah, It should be ClubGolf
HUMAN STAFF: as the password
```
**2 human messages for a wifi password.**

**What ClubAI would do:**
```
CUSTOMER: Hi, my first time at Clubhouse, just wondering if there's customer wifi
CLUBAI: Welcome! WiFi password is ClubGolf. Have a great first round!
```
**Instant. Friendly. Done.**

---

## TEST 6: "Do u have club rentals"
**Intent:** club_rental | **AI Assessment:** fully_ai

**What actually happened:**
```
CUSTOMER: Do u have to club rentals
AUTO-RESPONSE: Sorry we missed your call [...]
HUMAN STAFF: We have right hand clubs on location you can reserve them when making a booking!
CUSTOMER: No left hand?
HUMAN STAFF: No, we do not have any left hand clubs at this time.
```
**2 human messages.**

**What ClubAI would do:**
```
CUSTOMER: Do u have club rentals
CLUBAI: Yep! We have right-hand clubs at all locations — you can reserve them when making your booking. No left-hand clubs currently though, so lefties would need to bring their own.
```
**1 message covers both questions before the customer even asks.**

---

## TEST 7: "How does that work if we are two and want to play 18?"
**Intent:** how_long_18 | **AI Assessment:** fully_ai

**What actually happened:**
```
CUSTOMER: I have a question how does that work if we are two an want to play a 18? How long do we need to?
HUMAN STAFF: Usually two hours is enough time. You can change the settings to have a bigger gimme area for putting and it makes it go quicker!
CUSTOMER: 2h per person or for both?
HUMAN STAFF: For both. So rent one box for 2 hours or 2.5 if you want some extra time. If you create a trackman account you can save your rounds and pick back up in the future as well
CUSTOMER: Also, Can we rent club?
HUMAN STAFF: Yeah, we only have right hand clubs at the locations though!
CUSTOMER: Perfect and what's the price for a 18?
HUMAN STAFF: here is our pricing (says it better than i could) https://www.clubhouse247golf.com/pricing
```
**5 human messages across multiple follow-ups.**

**What ClubAI would do:**
```
CUSTOMER: I have a question how does that work if we are two an want to play a 18? How long do we need to?
CLUBAI: About 2 hours for two people — you rent one bay together, not per person. Tip: you can increase the gimme area in the putting settings to speed things up!

If you want to save your round and pick it up later, just create a free TrackMan account through the app.

CUSTOMER: Also, Can we rent club?
CLUBAI: Yep! Right-hand clubs available at all locations, just reserve them when you book. No lefty clubs currently though.

CUSTOMER: Perfect and what's the price for a 18?
CLUBAI: $39.95/hour for up to 4 people per bay. Full details here: clubhouse247golf.com/pricing
```
**AI handles the entire multi-question thread.**

---

## TEST 8: "Can't get the door open"
**Intent:** door_access | **AI Assessment:** ai_collects_info_then_human

**What actually happened:**
```
CUSTOMER: Hey, we're outside your Bedford location. We have it booked from 6-9. We can't open the door, the link works and the door beeps but the door stays shut.
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
HUMAN STAFF: Can you try and push then pull the door. I'll unlock it on our end as well
CUSTOMER: Try now
CUSTOMER: Nope. The handle doesn't turn
HUMAN STAFF: Handle doesn't turn you just pull open
CUSTOMER: Yeah not opening
HUMAN STAFF: (calls person inside to let them in)
```
**Physical door issue — needed human. But auto-response wasted time.**

**What ClubAI would do:**
```
CUSTOMER: Hey, we're outside your Bedford location. We have it booked from 6-9. We can't open the door, the link works and the door beeps but the door stays shut.
CLUBAI: The handle doesn't turn — just give the door a firm pull after it beeps! Sometimes it needs a good tug.

CUSTOMER: Yeah not opening even with pulling
CLUBAI: Got it — I'm getting a team member to unlock it from our end right now. Hang tight!

[ESCALATE TO HUMAN]
Customer: {number}
Location: Bedford
Issue: Door won't open — link works, door beeps, but won't open even when pulling
Tried: Customer confirmed pulling (not turning handle)
Priority: high
```
**AI tries the simple fix first, escalates fast with context. Human doesn't need to re-ask anything.**

---

## TEST 9: "Good morning, we have a booking for tonight and half our group has the flu"
**Intent:** booking_change (cancellation) | **AI Assessment:** ai_collects_info_then_human

**What actually happened:**
```
CUSTOMER: Good morning, we have a booking for tonight at the Truro location. Half of our group has the flu and are looking to cancel for tonight.
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
HUMAN STAFF: Yes, that's no problem at all. Hope everyone feels better!
CUSTOMER: Thank you, the booking is from 6:30 to 8:30 under Tanner Gayton. Are you able to refund for me or should I go through the booking changes email?
HUMAN STAFF: Already all complete for you!
```

**What ClubAI would do:**
```
CUSTOMER: Good morning, we have a booking for tonight at the Truro location. Half of our group has the flu and are looking to cancel for tonight.
CLUBAI: Sorry to hear that — hope everyone feels better! Let me get a team member to cancel that for you. What's the name on the booking and the time slot?

CUSTOMER: 6:30 to 8:30 under Tanner Gayton
CLUBAI: Got it — passing that along now. They'll confirm the cancellation shortly!

[ESCALATE TO HUMAN]
Customer: {number}
Location: Truro
Issue: Cancellation request — group has the flu
Details: Booking 6:30-8:30 under Tanner Gayton, tonight
Priority: normal
```
**AI collects all the info so the human can just process the refund without back-and-forth.**

---

## TEST 10: "Gift card not reflecting on my account"
**Intent:** gift_card | **AI Assessment:** ai_collects_info_then_human

**What actually happened:**
```
CUSTOMER: Good Day. I tried to redeem a gift card and it is not reflecting on my account at all. -Kenneth Brennan
AUTO-RESPONSE: Simulator issues? www.clubhouse247golf.com/howto [...]
(same customer texts again)
HUMAN STAFF: Hey Kenneth! You should be good to go now
CUSTOMER: Thank you
```

**What ClubAI would do:**
```
CUSTOMER: Good Day. I tried to redeem a gift card and it is not reflecting on my account at all. -Kenneth Brennan
CLUBAI: Hey Kenneth! Let me get a team member to sort that out for you — they'll check your account and text you back shortly.

[ESCALATE TO HUMAN]
Customer: {number}
Issue: Gift card not reflecting on account after redemption
Customer name: Kenneth Brennan
Priority: normal
```
**No wasted auto-response. Customer knows it's being handled.**

---

## SUMMARY: Impact Analysis

| Metric | Current (Auto-Response) | With ClubAI |
|--------|------------------------|-------------|
| Instant resolution rate | ~0% (auto-response never solves the issue) | ~39% (pricing, wifi, clubs, login, simple tech fixes) |
| Human messages saved per conversation | 0 | 2-5 on average |
| Customer wait time for simple questions | Minutes to hours (until human sees it) | Instant |
| Info collected before human sees escalation | None (human asks from scratch) | Location, box, name, what was tried |
| Customer frustration from irrelevant auto-response | High ("I asked about wifi and got a sim troubleshooting link") | Eliminated — AI responds to what they actually asked |
