-- 如果存在monitor_storage表，先删除
drop table if exists monitor_storage;

create table monitor_storage
(
    app_id      String,         -- 应用id
    event_type  String,         -- 事件类型
    message     String,         -- 消息内容
    create_at   DATETIME('Asia/Shanghai') DEFAULT now('Asia/Shanghai') -- 时间戳
)
    engine = MergeTree()
    ORDER BY tuple();

insert into monitor_storage(app_id, event_type, message)
values ('1', 'event1', 'message1'),
       ('2', 'event2', 'message2'),
       ('3', 'event3', 'message3'),
       ('4', 'event4', 'message4');

-- 如果已经存在物化视图，先删除
DROP TABLE IF EXISTS monitor_view;

-- 创建物化视图
create MATERIALIZED VIEW monitor_view
    ENGINE = MergeTree()
        ORDER BY tuple()
    POPULATE
AS
SELECT *,
       concat('monitor--', event_type) AS processed_message,
       now('Asia/Shanghai')            AS view_create_at
FROM monitor_storage


select * from monitor_view