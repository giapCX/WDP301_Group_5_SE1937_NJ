"""Generate the two Vietnamese XeDi contract PDFs in docs/.

Requires reportlab; uses Arial on Windows or DejaVu Sans on Linux.
Run from any directory: python docs/templates/generate_contract_templates.py
"""
from pathlib import Path
import os
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
FONT = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
if (FONT / 'arial.ttf').exists():
    regular, bold = FONT / 'arial.ttf', FONT / 'arialbd.ttf'
else:
    FONT = Path('/usr/share/fonts/truetype/dejavu')
    regular, bold = FONT / 'DejaVuSans.ttf', FONT / 'DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('Contract', str(regular)))
pdfmetrics.registerFont(TTFont('ContractBold', str(bold)))
pdfmetrics.registerFontFamily('Contract', normal='Contract', bold='ContractBold')
INK, TEAL, LIGHT = colors.HexColor('#192C38'), colors.HexColor('#006C60'), colors.HexColor('#EDF5F3')
BODY = ParagraphStyle('body', fontName='Contract', fontSize=10, leading=14.5, textColor=INK, spaceAfter=7, alignment=TA_JUSTIFY)
SMALL = ParagraphStyle('small', parent=BODY, fontSize=8.4, leading=11.5, spaceAfter=4, alignment=0)
TITLE = ParagraphStyle('title', parent=BODY, fontName='ContractBold', fontSize=17, leading=23, alignment=TA_CENTER, spaceAfter=7)
SUB = ParagraphStyle('sub', parent=SMALL, alignment=TA_CENTER, textColor=TEAL, spaceAfter=12)
HEAD = ParagraphStyle('head', parent=BODY, fontName='ContractBold', fontSize=11, leading=15, textColor=TEAL, spaceBefore=9, spaceAfter=6, keepWithNext=True)
CELL = ParagraphStyle('cell', parent=BODY, fontSize=9.2, leading=13, spaceAfter=0, alignment=0)
WIDTH = A4[0] - 96
LINE = '................................................................................'

def p(text, style=BODY):
    return Paragraph(text, style)

def h(text):
    return p(text, HEAD)

def fields(rows, widths=None):
    rows = [[p(escape(str(cell)), CELL) for cell in row] for row in rows]
    t = Table(rows, colWidths=widths or [150, WIDTH-150], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#CCD8D5')),
        ('BACKGROUND', (0, 0), (0, -1), LIGHT), ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

def note(text):
    t = Table([[p(text, SMALL)]], colWidths=[WIDTH])
    t.setStyle(TableStyle([('BACKGROUND', (0,0),(-1,-1),LIGHT), ('BOX',(0,0),(-1,-1),.5,TEAL), ('LEFTPADDING',(0,0),(-1,-1),10), ('RIGHTPADDING',(0,0),(-1,-1),10), ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    return t

def signatures(left, right):
    t = Table([[p('<b>'+left+'</b><br/>Ký và ghi rõ họ tên', SUB), p('<b>'+right+'</b><br/>Ký, ghi rõ họ tên / chức vụ', SUB)], ['', ''], [p('Họ tên: ...................................', CELL), p('Họ tên: ...................................', CELL)], [p('Ngày ký: .... / .... / ........', CELL), p('Ngày ký: .... / .... / ........', CELL)]], colWidths=[WIDTH/2]*2, rowHeights=[43,65,22,22])
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),8)]))
    return t

class NumberedCanvas:
    pass

def build(filename, label, pages):
    from reportlab.pdfgen.canvas import Canvas
    class PageCanvas(Canvas):
        def __init__(self, *args, **kwargs):
            Canvas.__init__(self, *args, **kwargs)
            self.states = []
        def showPage(self):
            self.states.append(dict(self.__dict__))
            self._startPage()
        def save(self):
            count = len(self.states)
            for state in self.states:
                self.__dict__.update(state)
                self.setStrokeColor(TEAL)
                self.setLineWidth(.7)
                self.line(48, A4[1]-36, A4[0]-48, A4[1]-36)
                self.setFont('ContractBold', 8)
                self.setFillColor(TEAL)
                self.drawString(48, A4[1]-28, 'XeDi | '+label)
                self.setFont('Contract', 7.5)
                self.setFillColor(INK)
                self.drawString(48, 28, 'MẪU ĐỒ ÁN - Chưa điền thông tin, chưa ký, chưa phát sinh hiệu lực')
                self.drawRightString(A4[0]-48, 28, f'{self._pageNumber} / {count}')
                Canvas.showPage(self)
            Canvas.save(self)
    story = []
    for i, page in enumerate(pages):
        if i: story.append(PageBreak())
        story.extend(page)
    doc = SimpleDocTemplate(str(ROOT / filename), pagesize=A4, leftMargin=48, rightMargin=48, topMargin=51, bottomMargin=48, title=label, author='XeDi - WDP301 Group 5', pageCompression=1)
    doc.build(story, canvasmaker=PageCanvas)
    print(ROOT / filename)

def intro(title, code):
    return [p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', SUB), p('Độc lập - Tự do - Hạnh phúc', SUB), p(title, TITLE), p(code+' | Phiên bản mẫu 1.0 | Ngày lập: .... / .... / ........', SUB), note('<b>Lưu ý sử dụng:</b> Mẫu phục vụ đồ án XeDi, bám theo OFFICIAL_BUSINESS_FLOWS.md v1.0. Các bên phải điền đủ nội dung, chốt phụ lục và rà soát pháp lý trước khi dùng thực tế. XeDi là tên sản phẩm; phải thay bằng tên pháp nhân, người đại diện và thẩm quyền thực tế. Các mức chính sách dưới đây là baseline dự án, không phải mức pháp luật ấn định.')]

renter = []
renter.append(intro('HỢP ĐỒNG THUÊ XE TỰ LÁI', 'Số: RENT-........ | Mã đặt xe: ........') + [
    h('Điều 1. Các bên và căn cứ đại diện'),
    p('<b>Bên cho thuê (A):</b> Chủ xe ................................................; giấy tờ định danh/MST ........................; địa chỉ ................................................ .'),
    p('<b>Đại diện được ủy quyền:</b> Pháp nhân vận hành XeDi ................................................; MST ........................; trụ sở ................................................; người ký/chức vụ ................................................; liên hệ ........................ .'),
    p('A được đại diện theo hợp đồng quản lý/ủy quyền số MGMT-........................ ngày .... / .... / ........, còn hiệu lực và cho phép ký hợp đồng thuê, giao nhận và thu hộ trong phạm vi đã thỏa thuận. Không mặc nhiên coi XeDi là chủ sở hữu xe.'),
    p('<b>Bên thuê (B):</b> Họ tên ................................................; ngày sinh ................; CCCD/hộ chiếu ................; địa chỉ ................................................; điện thoại ................; email ................................ .'),
    p('GPLX số ........................; hạng ........; ngày hết hạn ................; người được phép lái khác (nếu được A chấp thuận): ................................................ .'),
    h('Điều 2. Xe, thời gian và nơi giao nhận'),
    fields([('Xe / biển số', 'Hãng, mẫu: ........................ / Biển số: ........................'), ('Định danh xe', 'VIN/số khung: ........................; số chỗ: ........'), ('Thời gian thuê', 'Từ .... giờ .... ngày .... / .... / ........\nĐến .... giờ .... ngày .... / .... / ........'), ('Gara nhận và trả', 'Tên gara: ........................\nĐịa chỉ: ................................................'), ('Số ngày tính tiền', '........ ngày; tối thiểu 24 giờ, làm tròn lên mỗi 24 giờ')]),
    p('Múi giờ áp dụng: Việt Nam (UTC+7). Phạm vi sử dụng và giới hạn hành trình được điền tại Phụ lục A. Biên bản giao/nhận và ảnh được hai bên xác nhận là căn cứ hiện trạng xe.', SMALL),
])
renter.append([
    h('Điều 3. Tiền thuê, tiền cọc và điều kiện bàn giao'),
    fields([('Đơn giá thuê', '........................ VND/ngày'), ('Tiền thuê trước giảm giá', '........ ngày x ........................ = ........................ VND'), ('Phí dịch vụ / thuế', '........................ VND; đã gồm/chưa gồm: ........................'), ('Giảm giá / bên tài trợ', '........................ VND / ........................'), ('Tổng tiền thuê phải trả', '........................ VND; bằng chữ: ................................'), ('Tiền cọc riêng', '........................ VND; không tính là doanh thu thuê'), ('Thanh toán', 'Kênh/người thụ hưởng: ........................\nHạn thanh toán: .... giờ .... ngày .... / .... / ........')]),
    p('3.1. B thanh toán tiền thuê và cọc qua kênh được công bố; các khoản thực thu có chứng từ đối soát. Cọc được thu/hoàn riêng; không mặc nhiên là khoản phạt mất toàn bộ hoặc cơ chế phong tỏa thẻ.'),
    p('3.2. Với đặt xe trực tuyến, thời hạn ký và thanh toán sau khi được duyệt là 15 phút, theo hạn cụ thể hiển thị trong booking. Chỉ xác nhận chuyến khi hợp đồng, tiền thuê và cọc đầy đủ. Khoản đã thu cho booking hết hạn được hoàn/đối soát theo thực tế, không tự phục hồi chuyến.'),
    p('3.3. Chỉ giao xe khi xe đủ điều kiện, booking đã xác nhận, danh tính/GPLX và hợp đồng hợp lệ. Hai bên ghi ODO, nhiên liệu/pin, hư hỏng có sẵn, giấy tờ, chìa khóa, phụ kiện và giờ giao thực tế. Không ghi người nhận đã đồng ý khi chưa có xác nhận.'),
    h('Điều 4. Sử dụng xe và gia hạn'),
    p('4.1. A giao xe đúng mô tả, an toàn và có giấy tờ cần thiết; công bố hư hỏng, bảo hiểm, đầu mối hỗ trợ và phí đã thỏa thuận. B kiểm tra xe trước khi nhận, bảo quản hợp lý, tuân thủ giao thông; không giao người chưa được chấp thuận lái, cho thuê lại, dùng xe trái pháp luật hoặc vượt phạm vi sử dụng đã thống nhất.'),
    p('4.2. B chịu chi phí sử dụng đã thỏa thuận như nhiên liệu, cầu đường và đỗ xe; không tự sửa chữa lớn nếu chưa có chấp thuận, trừ xử lý cần thiết để bảo đảm an toàn có thông báo và chứng từ.'),
    p('4.3. Gia hạn chỉ có hiệu lực khi được kiểm tra lịch, chấp thuận phụ lục/giờ trả mới và thanh toán phần tăng. Trong lúc chờ, giờ trả cũ vẫn áp dụng. Không tự sửa lịch hoặc ảnh hưởng booking tiếp theo.'),
    h('Điều 5. Hủy trước bàn giao và không đến nhận'),
    p('B hủy trước giờ nhận ít nhất 48 giờ: hoàn toàn bộ tiền thuê. Dưới 48 giờ: phí hủy bằng mức nhỏ hơn giữa đơn giá một ngày và tiền thuê thực trả. Cọc được hoàn toàn bộ nếu chưa giao xe và không có nghĩa vụ hợp lệ khác. Phí dịch vụ không hoàn lại chỉ áp dụng khi đã ghi rõ tại Phụ lục A. A/nền tảng không thể cung cấp xe: hoàn khoản đã thu cho dịch vụ chưa cung cấp. Quá giờ nhận 60 phút phải liên hệ và lập ghi nhận trước khi xử lý không đến nhận; không mặc nhiên coi đã giao xe.'),
])
renter.append([
    h('Điều 6. Trả xe và các khoản phát sinh'),
    p('6.1. B trả xe tại gara và thời gian đã chốt. Hai bên lập biên bản trả, ghi thời điểm thực nhận xe, ODO, nhiên liệu/pin, phụ kiện, ảnh và ý kiến khác biệt. Xe đã trả không tiếp tục tính chậm trả chỉ vì nhân viên chưa hoàn tất nhập biên bản.'),
    p('6.2. Áp dụng ân hạn 30 phút. Số giờ chậm trả tính phí = làm tròn lên của max(0, thời gian trả thực tế - giờ trả đã chốt - 30 phút) / 1 giờ. Đơn giá điền tại Phụ lục A. Phí vượt km = max(0, km thực chạy - số ngày đã thanh toán x km miễn phí/ngày) x đơn giá/km.'),
    p('6.3. Phí nhiên liệu/pin, phụ kiện thiếu hoặc vệ sinh bất thường chỉ thu khi có đơn giá/cách tính đã chấp thuận và bằng chứng. Ô phí chưa điền hoặc chưa được chấp thuận không là căn cứ để tự bổ sung khoản thu. Trả sớm không tự hoàn ngày chưa dùng; ngoại lệ phải được thống nhất.'),
    h('Điều 7. Sự cố, bảo hiểm và trách nhiệm'),
    p('7.1. Khi tai nạn, hư hỏng, mất xe hoặc lỗi an toàn: ưu tiên bảo vệ người, liên hệ cơ quan/đơn vị khẩn cấp phù hợp và đầu mối XeDi; lưu hiện trường/chứng cứ khi an toàn, phối hợp bảo hiểm và xác minh. Không yêu cầu đủ ảnh mới tiếp nhận báo khẩn.'),
    p('7.2. Không mặc định B chịu mọi hư hỏng. Trách nhiệm được xác định theo chứng cứ trước/sau, lỗi, quan hệ nhân quả, hao mòn, lỗi kỹ thuật, bảo hiểm và thỏa thuận hợp pháp. Bảo hiểm chỉ chi trả trong phạm vi đơn bảo hiểm thực tế; không hứa bảo hiểm toàn bộ. Không bồi thường trùng cho cùng tổn thất.'),
    p('7.3. Operation xác minh và đề xuất; Manager xem xét khoản bồi thường/tranh chấp theo quy trình nội bộ. Việc phê duyệt nội bộ không tước quyền khiếu nại hoặc yêu cầu cơ quan có thẩm quyền giải quyết của các bên.'),
    h('Điều 8. Quyết toán, hoàn cọc và phản hồi'),
    p('8.1. B được cung cấp bảng quyết toán và bằng chứng. Thời hạn phản hồi nội bộ là 48 giờ từ khi đề xuất được thông báo qua kênh đã chọn; im lặng không được ghi thành đồng ý. Khoản tranh chấp được xử lý riêng, không mặc nhiên khấu trừ chỉ theo yêu cầu của chủ xe.'),
    p('8.2. Cọc hoàn = cọc thực thu - khấu trừ hợp lệ đã thực hiện - phần đã hoàn. Khấu trừ không vượt số cọc còn lại; phần vượt phải được xác lập riêng. Phần cọc không tranh chấp được lập lịch hoàn trong 3 ngày làm việc sau khi có biên bản trả và đủ thông tin đối soát. Chỉ giữ phần có căn cứ, thông báo lý do/mốc cập nhật; sau kết luận hoàn phần dư trong 3 ngày làm việc.'),
    p('8.3. Không giữ toàn bộ cọc vô thời hạn để chờ phạt nguội. Yêu cầu phạt nguội sau chuyến cần thông báo chính thức, thời gian vi phạm và đối chiếu người sử dụng, tránh thu trùng. Không tự trích tiền ngân hàng nếu thiếu căn cứ/thẩm quyền. Chỉ báo hoàn tiền thành công khi có kết quả đối soát.'),
])
renter.append([
    h('Phụ lục A. Thông số và biểu phí được chốt cùng hợp đồng'),
    fields([('Phạm vi sử dụng', '................................................'), ('Km miễn phí/ngày', '........................ km/ngày'), ('Phí vượt km / chậm trả', '........................ VND/km / ........................ VND/giờ'), ('Nhiên liệu / pin', 'Cách tính phần thiếu và đơn giá: ........................'), ('Vệ sinh / phụ kiện', 'Điều kiện và đơn giá: ........................'), ('Phí dịch vụ không hoàn', 'Không có / nội dung và số tiền đã chấp thuận: ........................'), ('Bảo hiểm áp dụng', 'Đơn vị, số đơn, phạm vi, mức miễn thường:\n................................................'), ('Giới hạn trách nhiệm', 'Thỏa thuận hợp pháp cụ thể (không để trống khi áp dụng):\n................................................'), ('Hỗ trợ / thông báo', 'Điện thoại: ........................; email/kênh tài khoản: ........................'), ('Hồ sơ kèm theo', 'Báo giá phiên bản ........; biên bản giao ........; biên bản trả ........; ảnh ........')]),
    h('Điều 9. Thông tin cá nhân, hiệu lực và giải quyết bất đồng'),
    p('Thông tin định danh, giấy phép và ảnh được dùng cho xác minh, giao nhận, thanh toán và xử lý sự cố; chỉ cung cấp cho người/đơn vị có thẩm quyền trong phạm vi cần thiết. Thời hạn lưu và đầu mối yêu cầu dữ liệu: ................................ . Không mặc nhiên cho phép theo dõi GPS liên tục hoặc dùng dữ liệu để quảng cáo.'),
    p('Hai bên ưu tiên thương lượng; nếu không giải quyết được có quyền yêu cầu cơ quan có thẩm quyền theo pháp luật Việt Nam. Không tự thêm thỏa thuận trọng tài hoặc hạn chế quyền khiếu nại. Hợp đồng có hiệu lực từ ........................, việc giao xe còn phụ thuộc Điều 3. Mọi sửa đổi sau ký phải bằng phụ lục/phiên bản có chấp thuận; bản đã ký được giữ nguyên.'),
    p('Lập thành ........ bản/ bản điện tử, mỗi bên nhận một bản đầy đủ. Chọn phương thức: ký giấy / ký điện tử theo quy trình được thỏa thuận. Với ký điện tử, lưu phiên bản nội dung, danh tính, dấu thời gian và bằng chứng xác nhận; không coi việc ghi chữ “OTP” là bằng chứng đã ký. Các bên đã đọc và chấp thuận cả bốn trang và Phụ lục A.', SMALL),
    signatures('BÊN THUÊ (B)', 'ĐẠI DIỆN HỢP LỆ CỦA BÊN A'),
])

owner = []
owner.append(intro('HỢP ĐỒNG QUẢN LÝ XE<br/>VÀ ỦY QUYỀN CHO THUÊ', 'Số: MGMT-........ | Mã xe: ........') + [
    h('Điều 1. Chủ xe và đơn vị quản lý'),
    p('<b>Bên giao quản lý/ủy quyền (A - Owner):</b> Họ tên/pháp nhân ................................................; CCCD/hộ chiếu/MST ........................; địa chỉ ................................................; điện thoại ................; email ................................ .'),
    p('Tư cách đối với xe: chủ sở hữu / đại diện hợp pháp theo văn bản số ........................ . Đồng sở hữu, tài sản bảo đảm hoặc hạn chế quyền định đoạt và chấp thuận liên quan (nếu có): ................................................ .'),
    p('<b>Bên nhận quản lý/ủy quyền (B):</b> Pháp nhân vận hành XeDi ................................................; MST ........................; địa chỉ ................................................; đại diện/chức vụ ................................................; căn cứ đại diện ........................; điện thoại/email ................................ .'),
    h('Điều 2. Xe và thời hạn quản lý'),
    fields([('Xe quản lý', 'Hãng/mẫu: ........................; biển số: ........................'), ('Thông tin đăng ký', 'VIN/số khung: ........................; đăng ký số: ........................'), ('Giấy tờ và bảo hiểm', 'Đăng kiểm đến: ................; bảo hiểm đến: ................\nChi tiết đơn bảo hiểm tại Phụ lục A'), ('Thời hạn', 'Từ .... / .... / ........ đến .... / .... / ........'), ('Gara quản lý', 'Tên/địa chỉ: ................................................')]),
    h('Điều 3. Phạm vi ủy quyền'),
    p('A giao B quyền trong thời hạn hợp đồng: quản lý listing/lịch xe; tiếp nhận và giữ xe tại gara; xét duyệt booking theo chính sách; đại diện A ký hợp đồng thuê; giao/nhận trả; thu hộ tiền thuê, cọc và khoản đã được xác lập hợp lệ; lập quyết toán. B ký nhân danh A trong phạm vi được ủy quyền, ghi rõ căn cứ đại diện.'),
    p('A không duyệt riêng từng booking. B không được bán, thế chấp hoặc chuyển quyền sở hữu xe; không ủy quyền lại ngoài phạm vi được A chấp thuận hoặc pháp luật cho phép. Các quyền loại trừ/giới hạn bổ sung: ................................................ .', SMALL),
])
owner.append([
    h('Điều 4. Giá thuê, hoa hồng và doanh thu'),
    fields([('Giá thuê được chốt', '........................ VND/ngày; phiên bản giá: ........................'), ('Quyền điều chỉnh giá', 'Khoảng/điều kiện được phép: ........................\nNgoài phạm vi phải được A chấp thuận'), ('Hoa hồng B', '........ %; baseline hợp đồng mới của dự án: 10%\nChỉ áp dụng tỷ lệ thực điền và được hai bên chấp thuận'), ('Chi phí khác / thuế', 'Nội dung, bên chịu, căn cứ và chứng từ: ........................'), ('Tài khoản nhận tiền A', 'Chủ tài khoản: ........................; số TK: ........................\nNgân hàng: ........................'), ('Thời hạn chi trả', 'Trong ........ ngày làm việc sau yêu cầu hợp lệ và đối soát')]),
    p('4.1. Hoa hồng chỉ tính trên cơ sở tiền thuê đã chốt theo hợp đồng; không tính trên cọc, bồi thường và khoản thu hộ. Mức tỷ lệ điền ở trên áp dụng cho hợp đồng này, không sửa hồi tố các hợp đồng đã ký. Thuế, phí và trách nhiệm kê khai được điền rõ tại Phụ lục A, không suy diễn từ hoa hồng.'),
    p('4.2. Doanh thu A = tiền thuê đủ điều kiện quyết toán - hoa hồng - các điều chỉnh hợp lệ được công bố. Voucher do nền tảng tài trợ không tự giảm doanh thu đã cam kết của A. Bồi thường được duyệt/đã thu ghi riêng; không ghi khoản chưa thu thành tiền khả dụng.'),
    p('4.3. A được xem doanh thu từng chuyến, phí, số chờ quyết toán, số khả dụng và khoản đang rút. Theo baseline, yêu cầu rút tối thiểu 100.000 VND, không vượt số khả dụng, qua tài khoản người thụ hưởng đã xác minh. Không cam kết doanh thu hoặc số chuyến tối thiểu nếu không có phụ lục riêng.'),
    h('Điều 5. Kiểm định, nhập gara và khai thác'),
    p('5.1. Xe phải qua kiểm định và phê duyệt, hợp đồng quản lý có hiệu lực rồi mới nhập gara và được xét xuất bản listing. Việc đạt kiểm định không tự xác nhận B đã nhận giữ xe. Trách nhiệm giữ xe bắt đầu từ thời điểm nhận thực tế được ghi trong biên bản.'),
    p('5.2. Khi nhận xe, hai bên ghi ODO, nhiên liệu/pin, ảnh, hư hỏng có sẵn, chìa khóa, giấy tờ và phụ kiện; người giao phải là A hoặc người có ủy quyền hợp lệ. A được nhận bản biên bản và liên kết chứng cứ. Nếu có khác biệt, ghi rõ trước khi xác nhận.'),
    p('5.3. B chỉ giao khách khi danh tính/GPLX, hợp đồng thuê, tiền thuê/cọc và tình trạng xe đủ điều kiện. Chặn lịch khi bảo trì/không an toàn, kiểm tra xe sau trả và giữ khoảng đệm vận hành. Thay đổi giá hoặc chính sách không tác động hồi tố booking/hợp đồng đã chốt.'),
])
owner.append([
    h('Điều 6. Quyền và nghĩa vụ của A'),
    p('6.1. A cung cấp thông tin sở hữu/đại diện trung thực, giấy tờ và bảo hiểm còn hiệu lực phù hợp mục đích sử dụng; thông báo hạn chế giao dịch, lỗi kỹ thuật, thay đổi giấy tờ và rủi ro an toàn. A phối hợp gia hạn giấy tờ, kiểm tra và bảo dưỡng theo lịch đã thỏa thuận.'),
    p('6.2. A có quyền theo dõi lịch, hiện trạng, doanh thu và yêu cầu giải trình; đề xuất cập nhật giá/mô tả, báo sự cố và yêu cầu rút xe theo Điều 9. A không tự xuất bản listing, xóa booking đã xác nhận hoặc quyết định khấu trừ cọc renter.'),
    h('Điều 7. Quyền và nghĩa vụ của B'),
    p('7.1. B sử dụng xe đúng phạm vi ủy quyền, bảo quản hợp lý, kiểm soát giao nhận và lưu bằng chứng; không dùng xe cho mục đích cá nhân ngoài thỏa thuận. B thông báo sự cố quan trọng, tình trạng bảo trì, kết quả điều tra và quyết toán; giải trình các khoản thu/chi bằng chứng từ.'),
    p('7.2. B có quyền từ chối booking hoặc ngừng khai thác khi xe/giấy tờ không đủ điều kiện; bố trí xử lý các booking đã có, thông báo các bên. Hạng mục sửa chữa, hạn mức được tự phê duyệt và chi phí gara/bảo dưỡng điền tại Phụ lục A. Ngoài hạn mức phải có chấp thuận, trừ xử lý khẩn để bảo đảm an toàn có ghi nhận.'),
    h('Điều 8. Sự cố, bảo hiểm và phân bổ tổn thất'),
    p('8.1. Mỗi sự cố được gắn xe và booking nếu có; hư hỏng phát sinh khi gara giữ xe vẫn được lập hồ sơ dù không có chuyến thuê. B thu thập ảnh trước/sau, biên bản, phản hồi và chi phí để phân biệt hao mòn, lỗi kỹ thuật, lỗi người thuê, lỗi giữ xe và nguyên nhân khác.'),
    p('8.2. Không mặc định người thuê chịu mọi tổn thất hoặc B bảo đảm bồi thường mọi rủi ro. Trách nhiệm căn cứ lỗi, nghĩa vụ, quan hệ nhân quả, thiệt hại thực tế, bảo hiểm và thỏa thuận hợp pháp. Đơn bảo hiểm, phạm vi, ngoại lệ, mức miễn thường và bên chịu được ghi ở Phụ lục A; không cam kết chi trả vượt đơn bảo hiểm thực tế.'),
    p('8.3. Operation xác minh/đề xuất, Manager xét khoản bồi thường và tranh chấp theo quy trình nội bộ. A được cung cấp căn cứ và phản hồi; cửa sổ phản hồi nội bộ là 48 giờ, im lặng không phải đồng ý. Khoản chưa kết luận không chuyển cho A; không bồi thường/khấu trừ hai lần cùng một tổn thất. Quyết định nội bộ không thay thế quyền yêu cầu cơ quan có thẩm quyền giải quyết.'),
    p('8.4. Với phạt nguội, A cung cấp thông báo chính thức, biển số, thời gian, số hồ sơ và số tiền; B đối chiếu chuyến/người dùng và hỗ trợ xử lý. Không giữ toàn bộ cọc vô thời hạn để chờ vi phạm có thể xuất hiện. Cọc khách là khoản quản lý riêng, không phải doanh thu chủ xe.'),
    h('Điều 9. Rút xe và chấm dứt'),
    p('A gửi yêu cầu rút trước tối thiểu 24 giờ. B dừng nhận booking mới, rà soát chuyến hiện tại/tương lai, sự cố và công nợ; thống nhất phương án thực hiện hoặc hủy/hoàn theo quy trình. Không tự xóa booking đã xác nhận. Giao trả cho đúng A/người được ủy quyền bằng biên bản ghi hiện trạng; không giả xác nhận khi A có bất đồng. Ngày chấm dứt pháp lý và ngày giao xe có thể khác nhau; nghĩa vụ đối soát/tranh chấp còn tồn tại được ghi rõ, không mặc định giữ xe vô thời hạn.'),
])
owner.append([
    h('Phụ lục A. Điều kiện thương mại và hồ sơ kèm theo'),
    fields([('Hạn mức sửa chữa', 'Tối đa ........................ VND/lần; phạm vi: ........................'), ('Bảo dưỡng / lưu gara', 'Bên chịu, lịch thực hiện và mức phí: ........................'), ('Bảo hiểm', 'Đơn vị/số đơn: ........................; phạm vi: ........................\nMiễn thường/ngoại lệ/bên chịu: ........................'), ('Thuế / phí / chứng từ', 'Trách nhiệm và cách tính: ................................................'), ('Rút xe / chấm dứt', 'Ngày hiệu lực, điều kiện và xử lý nghĩa vụ còn lại:\n................................................'), ('Liên hệ thông báo', 'A: ........................; B: ........................\nKênh có thể lưu bằng chứng: ........................'), ('Biên bản / phụ lục', 'Kiểm định số: ........; nhập gara số: ........; giao trả số: ........\nPhụ lục giá/chi phí/giới hạn trách nhiệm: ........................')]),
    h('Điều 10. Dữ liệu, sửa đổi và giải quyết bất đồng'),
    p('Thông tin cá nhân, tài khoản nhận tiền, giấy tờ và ảnh dùng cho quản lý hợp đồng, giao nhận, quyết toán và xử lý sự cố; truy cập theo thẩm quyền, không mặc nhiên cho phép theo dõi GPS liên tục hoặc quảng cáo. Thời hạn lưu/đầu mối yêu cầu dữ liệu: ................................................ .'),
    p('Hai bên ưu tiên thương lượng; nếu không thống nhất có quyền yêu cầu cơ quan có thẩm quyền theo pháp luật Việt Nam. Sự kiện bất khả kháng được thông báo, chứng minh, giảm thiểu thiệt hại và xử lý hậu quả theo thỏa thuận hợp pháp; không tự miễn toàn bộ nghĩa vụ đã phát sinh.'),
    p('Hợp đồng có hiệu lực từ ........................ đến ........................, trừ khi được gia hạn/chấm dứt hợp lệ. Sửa đổi, ủy quyền bổ sung, giá và nghĩa vụ mới phải được chốt bằng phụ lục/phiên bản có chấp thuận; không ghi đè bản đã ký. Phần để trống không tự tạo quyền thu phí hoặc quyền đại diện bổ sung.'),
    p('Lập ........ bản/ bản điện tử, mỗi bên nhận bản đầy đủ. Chọn: ký giấy / ký điện tử theo quy trình được thỏa thuận. Nếu ký điện tử phải lưu nội dung phiên bản, danh tính, dấu thời gian và bằng chứng chấp thuận; không mặc nhiên coi OTP demo là chữ ký số. Các bên xác nhận đã đọc và chấp thuận bốn trang, gồm Phụ lục A.', SMALL),
    signatures('CHỦ XE / BÊN A', 'ĐƠN VỊ QUẢN LÝ / BÊN B'),
])

if __name__ == '__main__':
    build('MAU_HOP_DONG_THUE_XE_RENTER.pdf', 'Hợp đồng thuê xe tự lái - Renter', renter)
    build('MAU_HOP_DONG_QUAN_LY_XE_OWNER.pdf', 'Hợp đồng quản lý xe - Owner', owner)
