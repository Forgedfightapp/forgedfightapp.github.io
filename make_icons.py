from PIL import Image, ImageDraw, ImageFont
BG=(11,13,16); FG=(238,241,245); AC=(62,232,181)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def make(size, scale):
    S=1024; im=Image.new('RGB',(S,S),BG); d=ImageDraw.Draw(im)
    # subtle accent ring/bar
    parts=[('D',FG),('>',AC),('M',FG)]
    fs=int(S*0.34*scale/0.8); f=ImageFont.truetype(FONT,fs)
    widths=[d.textlength(t,font=f) for t,_ in parts]; gap=fs*0.02
    total=sum(widths)+gap*2
    while total> S*0.78*scale:
        fs-=8; f=ImageFont.truetype(FONT,fs); widths=[d.textlength(t,font=f) for t,_ in parts]; gap=fs*0.02; total=sum(widths)+gap*2
    x=(S-total)/2; bb=d.textbbox((0,0),'DM',font=f); h=bb[3]-bb[1]; y=(S-h)/2-bb[1]-S*0.03
    for (t,c),w in zip(parts,widths):
        d.text((x,y),t,font=f,fill=c); x+=w+gap
    bw=S*0.30*scale; by=y+bb[3]+S*0.07*scale
    d.rounded_rectangle([(S-bw)/2,by,(S+bw)/2,by+S*0.035*scale],radius=int(S*0.02),fill=AC)
    return im.resize((size,size),Image.LANCZOS)
make(192,1.0).save('icons/icon-192.png')
make(512,1.0).save('icons/icon-512.png')
make(512,0.78).save('icons/icon-maskable-512.png')
make(192,0.78).save('icons/icon-maskable-192.png')
make(180,0.95).save('icons/apple-touch-icon.png')
make(32,1.0).save('icons/favicon-32.png')
