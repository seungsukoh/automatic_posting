create table if not exists posts (
  id integer primary key autoincrement,
  title text not null,
  body text not null,
  link_url text,
  hashtags text,
  image_key text,
  created_at text not null,
  updated_at text not null
);

create table if not exists post_targets (
  id integer primary key autoincrement,
  post_id integer not null,
  platform text not null,
  body_override text,
  status text not null default 'draft',
  created_at text not null,
  updated_at text not null,
  foreign key(post_id) references posts(id)
);

create table if not exists publish_jobs (
  id integer primary key autoincrement,
  post_target_id integer not null,
  platform text not null,
  scheduled_at text,
  started_at text,
  finished_at text,
  status text not null,
  retry_count integer not null default 0,
  error_message text,
  external_post_url text,
  created_at text not null,
  updated_at text not null,
  foreign key(post_target_id) references post_targets(id)
);

create table if not exists social_accounts (
  id integer primary key autoincrement,
  platform text not null,
  account_id text not null,
  username text,
  token_ref text,
  status text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists audit_logs (
  id integer primary key autoincrement,
  action text not null,
  target_type text not null,
  target_id integer,
  metadata text,
  created_at text not null
);
