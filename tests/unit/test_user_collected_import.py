import importlib.util
import json
import pathlib
import tempfile
import unittest

from openpyxl import Workbook


ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / 'scripts' / 'convert_user_collected_workbook.py'
SPEC = importlib.util.spec_from_file_location('convert_user_collected_workbook', MODULE_PATH)
CONVERTER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(CONVERTER)


class UserCollectedImportTests(unittest.TestCase):
    imported_at = '2026-09-06T00:00:00.000Z'

    def row(self, **overrides):
        value = {'类别': '景区概览', '餐类': '', '名称': '三峡示例景区', '所属景区': '', '城市/区县': '宜昌市西陵区', '地址': '示例路 1 号', '经纬度': '111.000000,30.000000', '电话': '0717-0000000', '内容': '适合步行游览的景区介绍。', '攻略/建议': '建议提前规划行程。', '价格参考': '100 元', '营业时间': '08:00-17:00', '设施/服务': '停车场', '车位信息': '50 个', '标签': '亲子，江景', '信息更新时间': '', '数据来源': '', '_row': 2}
        value.update(overrides)
        return value

    def test_maps_rows_with_stable_pairs_and_rejects_bad_coordinates(self):
        rows = [self.row(), self.row(类别='餐馆', 名称='三峡餐馆', 餐类='家常菜', _row=3), self.row(类别='露营地', 名称='三峡营地', _row=4), self.row(名称='无效坐标', 经纬度='not-a-coordinate', _row=5)]
        converted = CONVERTER.convert_workbook_rows(rows, self.imported_at)
        self.assertEqual([place['category'] for place in converted['places']], ['scenic', 'restaurant', 'camping'])
        self.assertEqual(len(converted['places']), len(converted['contents']))
        self.assertEqual(converted['report']['rejected'], [{'row': 5, 'reason': '经纬度无效'}])
        scenic = converted['places'][0]
        self.assertRegex(scenic['placeId'], r'^place-[a-f0-9]{16}$')
        self.assertEqual(scenic['_id'], scenic['placeId'])
        self.assertEqual((scenic['longitude'], scenic['latitude']), (111.0, 30.0))
        self.assertEqual(scenic['status'], 'published')
        self.assertEqual(scenic['sourceLevel'], 'user_collected')
        self.assertEqual(scenic['sources'][0]['title'], '向半斗整理收集')
        self.assertNotIn('100 元', scenic['intro'])
        self.assertIn('100 元', converted['contents'][0]['sections'][1]['text'])
        repeat = CONVERTER.convert_workbook_rows(rows, self.imported_at)
        self.assertEqual([item['placeId'] for item in repeat['places']], [item['placeId'] for item in converted['places']])

    def test_writes_parseable_json_lines(self):
        test_root = ROOT / '.local' / 'import' / 'test-tmp'
        test_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=test_root) as temp_dir:
            workbook = pathlib.Path(temp_dir) / 'fixture.xlsx'
            output = ROOT / '.local' / 'import' / 'unit-test-output'
            workbook_data = Workbook()
            sheet = workbook_data.active
            sheet.append(CONVERTER.EXPECTED_HEADERS)
            data = self.row()
            sheet.append([data[header] for header in CONVERTER.EXPECTED_HEADERS])
            workbook_data.save(workbook)
            converted = CONVERTER.convert_workbook(workbook, output, self.imported_at)
            places = [json.loads(line) for line in (output / 'places.jsonl').read_text(encoding='utf-8').splitlines()]
            contents = [json.loads(line) for line in (output / 'place_contents.jsonl').read_text(encoding='utf-8').splitlines()]
            self.assertEqual(converted['report']['accepted'], 1)
            self.assertEqual(len(places), 1)
            self.assertEqual(places[0]['_id'], contents[0]['_id'])


if __name__ == '__main__':
    unittest.main()
