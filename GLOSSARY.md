# Homeowner

Helps the people who look after their own home share the housework fairly, deciding each day who does which task so nobody gets overwhelmed.

## Language

The agreed Brazilian Portuguese wording for these terms is in [docs/glossary-pt-BR.md](docs/glossary-pt-BR.md).

### People and homes

**User**:
A person with an account. Owns their Baseline and their general Preferences and Restrictions, which travel with them between Homes.
_Avoid_: Person, Account, Profile

**Home**:
The place a group of Users live in and look after together, whether a house or an apartment.
_Avoid_: House, Household, Residence

**Resident**:
A User who lives in a Home. All Residents of a Home have equal say over it. A User is a Resident of at most one Home. Holds that User's Preferences and Restrictions for this Home's specific Chores.
_Avoid_: Member, Owner, Homeowner

**Invite**:
A single-use link a Resident shares to bring a new Resident into their Home, valid for seven days.
_Avoid_: Invitation code, Join link

**Guest**:
A User invited into a Home they do not live in, with access limited by the Residents. A User can be a Guest of many Homes.
_Avoid_: Visitor, Friend

### Work

**Chore**:
Something the Home needs done, with a Category, any Demands, a base Effort, an Importance, how many people it takes (one or two), and a schedule for how often it comes due. A Chore with no schedule comes due once.
_Avoid_: Activity, Job, Todo

**Catalog**:
The fixed list of common Chores built into the app, from which a new Home's first Chores are picked based on the answers given about the Home when it is created.
_Avoid_: Templates, Library, Defaults

**Category**:
What kind of work a Chore is, such as kitchen, laundry, bathroom, floors, trash, outdoor or pets. Every Chore has exactly one.
_Avoid_: Type, Area, Tag

**Demand**:
Something a Chore asks of the body, such as heavy lifting, bending, heights or strong chemicals. A Chore has none or several.
_Avoid_: Requirement, Tag, Difficulty

**Task**:
One Chore to be done on one date, given to as many Residents as the Chore takes. A Chore has at most one open Task at a time.
_Avoid_: Assignment, Occurrence, Instance

**Effort**:
How draining a piece of work is for each person doing it, in points from 1 to 5. A Chore has a base Effort. An open Task has a current Effort, which can grow above the base while the Task stays undone.
_Avoid_: Difficulty, Cost, Duration

**Importance**:
How much it matters that a Chore gets done: essential, normal or nice to have.
_Avoid_: Priority, Urgency

**Completion**:
The record that specific people did a Task at a specific time. Any one of the Task's Residents can record it for all of them.
_Avoid_: Done flag, Checkmark

### Capacity

**Energy**:
How much Effort a Resident can give on a given day, in the same points as Effort.
_Avoid_: Mood, Capacity, Stamina

**Baseline**:
A User's usual Energy for each day of the week.
_Avoid_: Default energy, Normal

**Check-in**:
A Resident's daily report of how they feel compared with their Baseline: Drained (no Tasks today), Low, Normal or Energized. It sets that day's Energy and can add Restrictions for that day only.
_Avoid_: Mood check, Survey

**Preference**:
A like, neutral or dislike, either general (a User's, about a Category) or specific (a Resident's, about one Chore of their Home). Specific beats general; neutral unless stated. It gives way to Importance, and Chores that several Residents dislike are shared out in turns.
_Avoid_: Favourite, Taste

**Restriction**:
Work a User cannot do, which the system never gives them: either general (a User's, about a Demand) or specific (a Resident's, about one Chore of their Home). Lasting, or for one day when set at a Check-in.
_Avoid_: Limitation, Exclusion

### Planning

**Allocation**:
The daily run, at a fixed time, that proposes which open Tasks each Resident does that day without exceeding anyone's Energy.
_Avoid_: Scheduling, Distribution

**Day Plan**:
What an Allocation proposes for one Home on one day. Residents can accept, refuse or swap what it proposes.
_Avoid_: Schedule, Agenda, Daily list

**Committed**:
A Task a Resident has explicitly accepted from their Day Plan, or taken for themselves. Only the Resident can commit; the system only proposes.
_Avoid_: Assigned, Claimed

**Swap**:
One Resident's offer to exchange one of their Tasks for another Resident's in today's Day Plan. It happens only when the other Resident accepts; declining changes nothing and costs nothing. When it happens, both Residents are Committed to the Task they receive.
_Avoid_: Trade, Exchange

### Rewards

**Streak**:
The run of days on which a Resident completed at least one Task. A day on which they Committed to Tasks and completed none breaks it, unless they checked in Drained; any other day pauses it.
_Avoid_: Combo, Chain
