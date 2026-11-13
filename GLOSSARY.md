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
What kind of work a Chore is, such as kitchen, laundry, bathroom, floors, trash, outdoor or pets. Every Chore has exactly one. "Category" belongs to Chores only: money uses Spending Category.
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
The record that specific people did a Task at a specific time. Any one of the Task's Residents can record it for all of them. A named Resident can correct its time, up to 30 days back.
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

**Voice command**:
Something a Resident says to the app, such as "I'll take the dishes", that it turns into proposed changes to Chores or Tasks. Nothing changes until the Resident confirms them.
_Avoid_: Voice assistant, Speech command

### Rewards

**Streak**:
The run of days on which a Resident completed at least one Task. A day on which they Committed to Tasks and completed none breaks it, unless they checked in Drained; any other day pauses it.
_Avoid_: Combo, Chain

### Money

Finances is open only to Users on an allowlist of emails. These terms are about money; "Category" stays with Chores.

**Transaction**:
One movement of money on a Source, such as a purchase or a payment, with a date, an amount and a description.
_Avoid_: Entry, Expense, Payment

**Source**:
A place Transactions come from, such as a bank account or a credit card, connected to the app. A credit card's Transactions count as spent in the month their card bill is due, not the day they were made. The User can give a Source a display name of their own; the bank's name is kept beside it.
_Avoid_: Account, Bank, Connection

**Spending Category**:
What a Transaction was spent on, such as groceries, transport or rent. Every Transaction has at most one. It is not a Chore's Category.
_Avoid_: Category, Tag, Label

**Bill to pay**:
Money owed that is due on a date, such as the credit card bill, rent or a utility. It is not a Transaction until it is paid. A credit card Source's bill is never entered by the User: a closed bill takes the total the bank reports; the open bill is the app's sum of the card's charges since the last closing plus the known installments; a card the bank sends no bills for keeps the app's computed bill.
_Avoid_: Invoice, Debt, Due

**Installment plan**:
A purchase paid in several equal parts over several months. Each part is a Transaction.
_Avoid_: Financing, Loan, Subscription

**Monthly income**:
The money a User expects to receive each month, which Finances compares with what is spent.
_Avoid_: Salary, Revenue, Earnings

**Leftover**:
What remains of the Monthly income after everything a month takes: Monthly income − (card bills due in the month + other Bills to pay + installments off the card + Planned spending + money already spent off the card this month + the larger of the month's Saving and the Monthly contribution). It can be negative, and is absent when no Monthly income is set.
_Avoid_: Balance, Surplus, Savings

**Daily allowance**:
The Leftover divided by the days left in the month, today included (São Paulo calendar). It is negative when the Leftover is, and absent when no Monthly income is set or the month is not the current one.
_Avoid_: Daily budget, Daily limit

**Pace**:
The money spent so far this month, day by day (cumulative), against a straight line from 0 on the first day to (Monthly income − Leftover) on the last. Absent when no Monthly income is set; a past month holds all its days. It is not the usual pace, the average of the previous months' spending.
_Avoid_: Average, Trend

**Planned spending**:
What each Spending Category is still expected to take in a month, which lowers that month's Leftover. A category with a Spending limit plans its limit; one without plans the average of what it spent in the 3 months before the current one (months before the User's first data left out; a negative average counts as 0). Both subtract what already counts for the category in the month, never going below zero.
_Avoid_: Budget, Forecast, Reserve

**Saving**:
Money a User puts aside, such as money moved into an investment, net of what they take back. It is neither spending nor a Transfer: it is left out of spending totals and lowers the Leftover. The Transaction type is `saving`.
_Avoid_: Investment (that is the asset), Savings (the Savings tab and the Goals and Emergency reserve), Transfer

**Spending limit**:
The most a User wants to spend in one Spending Category in a month. It is set once and holds for every month; a category with no limit has none.
_Avoid_: Budget (in copy), Cap, Quota

**Investment**:
Money a User has put away, with a name, a current value and what it serves: the Emergency reserve or the Goals. An Investment can be typed by hand or come from the bank; one from the bank starts with nothing picked and counts toward neither until the User picks.
_Avoid_: Asset, Account, Portfolio

**Net worth**:
Source balances + Investments − card bills not yet paid. Every Investment counts, picked or not. Card Sources' own balances are never counted, and Bills to pay that are not on a card are left out. A card bill is not yet paid until its due date passes: the closed bill and the open bill both count while their due date (the one the bank reported, else the card's due day) is today or later, because nothing records a bill as paid and, after the due date, the payment has already left a checking balance. A card with neither a reported bill nor a due day counts only its current month. Its daily series is Source balances + Investments only, since past days' card bills are not stored.
_Avoid_: Wealth, Total balance

**Emergency reserve**:
The amount a User wants set aside for the unexpected. It has a target; the Investments that serve it count toward it.
_Avoid_: Rainy-day fund, Safety net, Savings (alone)

**Goal**:
Something a User saves toward, with a target amount and, optionally, a target month. Goals are ordered; the order decides who is served first.
_Avoid_: Objective, Dream, Target (alone)

**Monthly contribution**:
The amount a User puts into savings each month, and the share of it that goes to the Emergency reserve; the rest goes to the Goals. Sharing it among the Goals is the "contribution split", never "allocation": Allocation is the Chores module.
_Avoid_: Deposit, Savings rate
