"""CH-625 (customer accounts point 11, the portal screens): the three test
accounts for the screen sweep. Runs ONLY in the GitHub test job, on a
throwaway database of its own (config.isolation_settings) - never on a server.

    python manage.py shell --settings=config.isolation_settings < seed.py

Our main account and two customer accounts (Test A, Test B), each with a
campaign, buyer, destination, publisher, TFN, routing rule and calls (with
their Reports copies), and an admin login. Every name carries a word found
nowhere else (isoqmainx, isoqax, isoqbx) so a screen showing it is caught.
Writes /tmp/isolation/accounts.json for the robot.
"""
import json
import os
import secrets

from accounts.models import Organization, User
from buyers.destination import Destination
from buyers.models import Buyer
from campaigns.models import Campaign
from phone_numbers.models import PhoneNumber
from publishers.models import Publisher
from routing.models import CallLog, RoutingRule, RuleDestination
from routing.signals import mirror_call_log

out = {}
for key, slug, digit in (('main', 'interns', '3'), ('A', 'iso-test-a', '1'), ('B', 'iso-test-b', '2')):
    org = Organization.objects.create(name=f'Isolation {key}', slug=slug)
    tag = f'isoq{key.lower()}x'
    campaign = Campaign.objects.create(organization=org, name=f'{tag} campaign')
    buyer = Buyer.objects.create(organization=org, name=f'{tag} buyer', status='active')
    publisher = Publisher.objects.create(organization=org, name=f'{tag} publisher', status='active')
    tfn = PhoneNumber.objects.create(organization=org, number=f'+1800555{digit}001',
                                     campaign=campaign, publisher=publisher)
    line = Destination.objects.create(organization=org, buyer=buyer, name=f'{tag} line',
                                      tfn=f'+1844555{digit}001')
    rule = RoutingRule.objects.create(organization=org, campaign=campaign, name=f'{tag} rule',
                                      rule_type='priority')
    RuleDestination.objects.create(rule=rule, destination=line.tfn, buyer=buyer)
    for i in range(2):
        c = CallLog.objects.create(
            organization=org, campaign=campaign, buyer=buyer, publisher=publisher,
            caller_number=f'+1555555{digit}00{i}', called_number=tfn.number,
            twilio_call_sid=f'CAISOS{key}{i}', status=CallLog.Status.COMPLETED, duration=40,
            destination_number=line.tfn)
        mirror_call_log(str(c.id))
    password = 'Iso-' + secrets.token_urlsafe(12)       # this run only
    email = f'iso-{key.lower()}@isolation.test'
    admin = User.objects.create(username=f'iso-{key.lower()}', email=email, organization=org,
                                role='admin', is_active=True, first_name=f'Iso {key}')
    admin.set_password(password)
    admin.save()
    out[key] = {
        'email': email, 'password': password, 'tag': tag,
        'numbers': [f'800555{digit}001', f'844555{digit}001'] + [f'555555{digit}00{i}' for i in range(2)],
        'ids': {'campaign': str(campaign.id), 'buyer': str(buyer.id), 'publisher': str(publisher.id),
                'destination': str(line.id), 'rule': str(rule.id)},
    }

os.makedirs('/tmp/isolation', exist_ok=True)
with open('/tmp/isolation/accounts.json', 'w') as f:
    json.dump(out, f)
print('isolation accounts ready:', ', '.join(out))
