"""Generate small workout files (GPX, TCX, FIT, CSV) for the import tests."""
import struct, math, datetime, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
start = datetime.datetime(2026, 9, 28, 6, 30, 0, tzinfo=datetime.timezone.utc)
# 21 points, 30 s apart, ~1/60 deg lat ≈ moving north ~ 150 m per step => 3.0 km in 10 min
pts = [(30.2672 + i * 0.00135, -97.7431, start + datetime.timedelta(seconds=30 * i), 140 + i) for i in range(21)]
iso = lambda t: t.strftime('%Y-%m-%dT%H:%M:%SZ')
gpx = '<?xml version="1.0"?>\n<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Morning Run</name><type>running</type><trkseg>' + ''.join(
    f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"><time>{iso(t)}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>{hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>' for la, lo, t, hr in pts) + '</trkseg></trk></gpx>\n'
open(os.path.join(OUT, 'run.gpx'), 'w').write(gpx)
tcx = f'''<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>{iso(start)}</Id>
<Lap StartTime="{iso(start)}"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>12000</DistanceMeters><Calories>410</Calories><AverageHeartRateBpm><Value>138</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>161</Value></MaximumHeartRateBpm><Track>
''' + ''.join(f'<Trackpoint><Time>{iso(start + datetime.timedelta(seconds=60*i))}</Time><DistanceMeters>{400*i}</DistanceMeters><HeartRateBpm><Value>{125+i}</Value></HeartRateBpm></Trackpoint>' for i in range(30)) + '''
</Track></Lap><Lap StartTime="x"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>4000</DistanceMeters><Calories>140</Calories><AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>168</Value></MaximumHeartRateBpm></Lap>
</Activity></Activities></TrainingCenterDatabase>
'''
open(os.path.join(OUT, 'ride.tcx'), 'w').write(tcx)
# FIT
FIT_EPOCH = 631065600
ts0 = int(start.timestamp()) - FIT_EPOCH
body = b''
# definition local 0: record(20): timestamp(253,u32), heart_rate(3,u8), distance(5,u32)
body += bytes([0x40, 0, 0]) + struct.pack('<H', 20) + bytes([3]) + bytes([253, 4, 0x86, 3, 1, 0x02, 5, 4, 0x86])
for i in range(41):  # 20 minutes, every 30 s, 5 km total
    body += bytes([0x00]) + struct.pack('<IBI', ts0 + 30 * i, 120 + i, int(5000 * 100 * i / 40))
# definition local 1: session(18)
fields = [(2, 4, 0x86), (5, 1, 0x00), (7, 4, 0x86), (8, 4, 0x86), (9, 4, 0x86), (11, 2, 0x84), (16, 1, 0x02), (17, 1, 0x02)]
body += bytes([0x41, 0, 0]) + struct.pack('<H', 18) + bytes([len(fields)]) + b''.join(bytes(f) for f in fields)
body += bytes([0x01]) + struct.pack('<IBIIIHBB', ts0, 15, 1200 * 1000, 1200 * 1000, 5000 * 100, 320, 139, 160)  # sport 15 = rowing
hdr = struct.pack('<BBHI4sH', 14, 0x10, 2100, len(body), b'.FIT', 0)
open(os.path.join(OUT, 'row.fit'), 'wb').write(hdr + body + b'\x00\x00')
open(os.path.join(OUT, 'workouts.csv'), 'w').write(
    'date,category,activity,duration_min,distance,unit,avg_hr,max_hr,calories,notes\n'
    '2026-09-20,cardio,run,32,5,km,152,171,390,"Easy 5k, felt good"\n'
    '9/21/2026,striking,muay thai,60,,,148,180,650,Pads + sparring\n'
    '2026-09-22,weights,,50,,,,,,Upper body\n'
    '2026-09-23,,swim,40,1500,m,,,,Pool\n')
print('fixtures written to', OUT)
